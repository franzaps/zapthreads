import { defaultPicture, generateTags, satsAbbrev, shortenEncodedId, updateProfiles } from "./util/ui.ts";
import { Show, createEffect, createSignal } from "solid-js";
import { UnsignedEvent, Event } from "nostr-tools/core";
import { EventSigner, pool, signersStore, store } from "./util/stores.ts";
import { generateSecretKey, getPublicKey, getEventHash, finalizeEvent } from "nostr-tools/pure";
import { createAutofocus } from "@solid-primitives/autofocus";
import { find, save, watch } from "./util/db.ts";
import { Profile, eventToNoteEvent } from "./util/models.ts";
import { lightningSvg, likeSvg } from "./thread.tsx";
import { decode, npubEncode } from "nostr-tools/nip19";
import { Relay } from "nostr-tools/relay";
import { normalizeURL } from "nostr-tools/utils";

export const ReplyEditor = (props: { replyTo?: string; onDone?: Function; input?: boolean; isFocus?: boolean }) => {
  const [comment, setComment] = createSignal('');
  const [loading, setLoading] = createSignal(false);
  const [isLoginProcess, setLoginProcess] = createSignal(false);
  const [loggedInUser, setLoggedInUser] = createSignal<Profile>();
  const [errorMessage, setErrorMessage] = createSignal('');

  const anchor = () => store.anchor!;
  const profiles = store.profiles!;
  const relays = () => store.relays!;
  const isNpubPro = store.npubPro === 'true'

  // Sessions

  const login = async () => {
    if(isNpubPro) {
      setLoginProcess(true)
    }

    if (!window.nostr) {
      onError('Error: No NIP-07 extension!');
      return;
    }
    const pk = await window.nostr!.getPublicKey();

    signersStore.internal = {
      pk,
      signEvent: async (event) => window.nostr!.signEvent(event)
    };

    setErrorMessage(''); // clear error
    signersStore.active = signersStore.internal;
  };

  // Logged in user is a computed property of the active signer
  createEffect(async () => {
    if (signersStore.active) {
      const pk = signersStore.active.pk;
      let profile = profiles().find(p => p.pk === pk);
      if (!profile) {
        profile = { pk, l: 0, ts: 0 };
        await save('profiles', profile);
      }
      setLoggedInUser(profile);
      updateProfiles([pk], relays(), profiles());
    } else {
      setLoggedInUser();
    }
  });

  // for npubPro mode this will publish the
  // comment after login was executed
  createEffect(async () => {
    if(isNpubPro) {
      if(loggedInUser() && isLoginProcess()) {
        setLoginProcess(false)
  
        if(comment().length) {
          await publish(loggedInUser())
        }
      }
    }
  });

  // Publishing

  const onSuccess = async (event: Event, notice?: string) => {
    setLoading(false);
    // reset comment & error message (unless supplied)
    setComment('');
    setErrorMessage(notice ?? '');

    await save('events', eventToNoteEvent(event as Event), { immediate: true });

    // callback (closes the reply form)
    props.onDone?.call(this);
  };

  const onError = (message: string) => {
    setLoading(false);
    // set error message
    setErrorMessage(`Error: ${message}`);
  };

  const publish = async (profile?: Profile) => {
    let signer: EventSigner | undefined;
    if (profile) {
      signer = signersStore.active;
    } else {
      if (!signersStore.anonymous) {
        const sk = generateSecretKey();
        signersStore.anonymous = {
          pk: getPublicKey(sk),
          signEvent: async (event) => ({ sig: finalizeEvent(event, sk).sig }),
        };
      }
      signer = signersStore.anonymous;
    }

    if (!signer?.signEvent) {
      onError('Error: User has no signer!');
      return;
    }

    const content = comment().trim();
    if (!content) return;

    const unsignedEvent: UnsignedEvent = {
      kind: 1,
      created_at: Math.round(Date.now() / 1000),
      content: content,
      pubkey: signer.pk,
      tags: generateTags(content),
    };

    if (store.anchorAuthor !== unsignedEvent.pubkey) {
      // Add p tag from note author to notify them
      unsignedEvent.tags.push(['p', store.anchorAuthor!]);
    }

    if (store.externalAuthor) {
      try {
        const pubkey = decode(store.externalAuthor).data as string;
        unsignedEvent.tags.push(['p', pubkey]);
      } catch (_) { }
    }

    // If it is a reply, prepare root and reply tags
    if (props.replyTo) {
      const replyEvent = await find('events', IDBKeyRange.only(props.replyTo));
      if (replyEvent) {
        // If it is a reply, it must have a root
        unsignedEvent.tags.push(['e', replyEvent.ro!, '', 'root']);
        // If the user is not replying to themselves, add p to notify
        if (replyEvent.pk !== unsignedEvent.pubkey) {
          unsignedEvent.tags.push(['p', replyEvent.pk]);
        }
      }
      unsignedEvent.tags.push(['e', props.replyTo, '', 'reply']);
    } else {
      // Otherwise find the root
      const rootEventId = store.version || store.rootEventIds[0];
      if (rootEventId) {
        unsignedEvent.tags.push(['e', rootEventId, '', 'root']);
      } else if (anchor().type === 'http') {
        // If no root tag is present, create it to use as anchor
        const url = normalizeURL(anchor().value);
        const unsignedRootEvent: UnsignedEvent = {
          pubkey: signer.pk,
          created_at: Math.round(Date.now() / 1000),
          kind: 8812,
          tags: [['r', url]],
          content: `Comments on ${url} ↴`
        };

        const rootEvent: Event = {
          id: getEventHash(unsignedRootEvent),
          ...unsignedRootEvent,
          ...await signer.signEvent(unsignedRootEvent)
        };

        save('events', eventToNoteEvent(rootEvent));

        // Publish, store filter and get updated rootTag
        if (store.disableFeatures!.includes('publish')) {
          console.log('Publishing root event disabled', rootEvent);
        } else {
          pool.publish(relays(), rootEvent);
        }
        // Update filter to this rootEvent
        store.filter = { "#e": [rootEvent.id] };
        unsignedEvent.tags.push(['e', rootEvent.id, '', 'root']);
      }
    }

    if (anchor().type === 'naddr') {
      unsignedEvent.tags.push(['a', anchor().value, '', 'root']);
    }

    const id = getEventHash(unsignedEvent);

    // Attempt to sign the event
    const signature = await signer.signEvent(unsignedEvent);

    const event: Event = { id, ...unsignedEvent, ...signature };

    setLoading(true);
    console.log(JSON.stringify(event, null, 2));

    if (store.disableFeatures!.includes('publish')) {
      // Simulate publishing
      setTimeout(() => onSuccess(event), 1000);
    } else {
      const failures: string[] = [];
      const promises = [];
      for (const relayUrl of relays()) {
        promises.push(new Promise<void>(async (ok) => {
          try {
            const relay = await Relay.connect(relayUrl);
            await relay.publish(event);
          } catch (e) {
            console.warn(e);
            failures.push(relayUrl);
          }
          ok();
        }))
      }

      // publish in parallel
      await Promise.allSettled(promises);

      if (failures.length === relays().length) {
        onError('Error: Your comment was not published to any relay');
      } else {
        const msg = `Published to ${failures.length}/${relays().length} relays (see console for more info)`;
        const notice = !isNpubPro && failures.length > 0 ? msg : undefined;
        onSuccess(event, notice);
      }
      // clear up failure log
      failures.length = 0;
    };
  };

  // Only autofocus if 
  const autofocus = props.replyTo !== undefined;
  let ref!: HTMLInputElement & HTMLTextAreaElement ;
  createAutofocus(() => props.isFocus ? (autofocus && ref) : false);

  return <div class="ztr-reply-form">
    {props.input ?
      <input
          disabled={loading()}
          value={comment()}
          placeholder="Reply something..."
          autofocus={props.isFocus ? autofocus : false}
          ref={ref}
          onChange={e => setComment(e.target.value)}
      /> : (
            <textarea
                disabled={loading()}
                value={comment()}
                placeholder={store.replyPlaceholder || 'Add your comment...'}
                autofocus={autofocus}
                ref={ref}
                onChange={e => setComment(e.target.value)}
            />
        )
    }
    {isNpubPro && !loggedInUser() && <div class="ztr-reply-controls"><button class="ztr-reply-login-button" onClick={() => login()}>Reply</button></div>}
    {!(isNpubPro && !loggedInUser()) && <div class="ztr-reply-controls">
      {store.disableFeatures!.includes('publish') && <span>Publishing is disabled</span>}
      {errorMessage() && <span class="ztr-reply-error">Error: {errorMessage()}</span>}

      <Show when={!loading()} fallback={
        <svg class="ztr-spinner" viewBox="0 0 50 50">
          <circle class="path" cx="25" cy="25" r="20" fill="none" stroke-width="5"></circle>
        </svg>
      }>
        <div class="ztr-comment-info-picture">
          <img src={loggedInUser()?.i || defaultPicture} />
        </div>
      </Show>

      {loggedInUser() &&
        <button disabled={loading()} class="ztr-reply-button" onClick={() => publish(loggedInUser())}>
          {isNpubPro && <>Reply</>}
          {!isNpubPro && <>Reply as {loggedInUser()!.n || shortenEncodedId(npubEncode(loggedInUser()!.pk))}</>}
        </button>}

      {!loggedInUser() && !store.disableFeatures!.includes('replyAnonymously') &&
        <button disabled={loading()} class="ztr-reply-button" onClick={() => publish()}>
          Reply anonymously
        </button>}

      {!loggedInUser() && <button class="ztr-reply-login-button" onClick={() => login()}>Log in</button>}
    </div>}

  </div>;
};

export const RootComment = (props: {handleExitThread?: boolean}) => {
  const anchor = () => store.anchor!;

  const zapsAggregate = watch(() => ['aggregates', IDBKeyRange.only([anchor().value, 9735])]);
  const likesAggregate = watch(() => ['aggregates', IDBKeyRange.only([anchor().value, 7])]);
  const zapCount = () => zapsAggregate()?.sum ?? 0;
  const likeCount = () => likesAggregate()?.ids.length ?? 0;

  const handleExit = () => {
    if (props.handleExitThread) {
      store.activeThreadId = null
    }
  }

  return <div class="ztr-comment-new">
    <div class="ztr-comment-body">
      <ul class="ztr-comment-actions">
        <Show when={!store.disableFeatures!.includes('likes')}>
          <li class="ztr-comment-action-like">
            {likeSvg()}
            <span>{likeCount()} likes</span>
          </li>
        </Show>
        <Show when={!store.disableFeatures!.includes('zaps')}>
          <li class="ztr-comment-action-zap">
            {lightningSvg()}
            <span>{satsAbbrev(zapCount())} sats</span>
          </li>
        </Show>
      </ul>
      <ReplyEditor onDone={() => handleExit()} />
    </div>
  </div>;
};