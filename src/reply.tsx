import { defaultPicture, shortenEncodedId, tagFor, updateProfiles } from "./util/ui";
import { Show, createEffect, createSignal, on, useContext } from "solid-js";
import { UnsignedEvent, Event, getSignature, getEventHash } from "./nostr-tools/event";
import { EventSigner, pool, StoredProfile, ZapEvent, ZapThreadsContext } from "./util/stores";
import { generatePrivateKey, getPublicKey } from "./nostr-tools/keys";
import { npubEncode } from "./nostr-tools/nip19";
import { createAutofocus } from "@solid-primitives/autofocus";
import { find, save, watchAll } from "./util/db";
import { lightningSvg, likeSvg } from "./thread";

export const ReplyEditor = (props: { replyTo?: string; onDone?: Function; }) => {
  const { relays, anchor, pubkey, profiles, signersStore, preferencesStore } = useContext(ZapThreadsContext)!;

  const [comment, setComment] = createSignal('');
  const [loading, setLoading] = createSignal(false);
  const [loggedInUser, setLoggedInUser] = createSignal<StoredProfile>();
  const [errorMessage, setErrorMessage] = createSignal('');

  // Sessions

  const login = async (loginType: 'internal' | 'external') => {
    let pk: string;
    if (pubkey() && loginType == 'external') {
      pk = pubkey()!;
    } else {
      if (!window.nostr) {
        onError('No NIP-07 extension!');
        return;
      }
      pk = await window.nostr!.getPublicKey();
    }

    signersStore[loginType] ||= {
      pk,
      signEvent: async (event) => {
        // We do this here in order to delay prompting the user as much as possible
        const extensionPubkey = await window.nostr!.getPublicKey();
        const loggedInPubkey = loggedInUser()!.pubkey;
        if (loggedInPubkey !== extensionPubkey) {
          // If zapthreads was passed a different pubkey then throw
          setErrorMessage('Pubkey mismatch');
          throw `Pubkey mismatch: ${loggedInPubkey} !== ${extensionPubkey}`;
        }
        return window.nostr!.signEvent(event);
      }
    };

    onError('');
    signersStore.active = signersStore.external || signersStore.internal;
  };

  // Auto login when external pubkey supplied
  createEffect(on(pubkey, (pubkey) => {
    if (pubkey) {
      login('external');
    }
  }));

  // Log out when external pubkey is absent
  createEffect(on(pubkey, (pubkey) => {
    if (!pubkey) {
      signersStore.active = undefined;
      // reset error message
      setErrorMessage('');
    }
  }, { defer: true }));

  // Logged in user is a computed property of the active signer
  createEffect(async () => {
    if (signersStore.active) {
      const pk = signersStore.active.pk;
      let profile = profiles().find(p => p.pubkey === pk);
      if (!profile) {
        profile = { pubkey: pk, lastChecked: 0, created_at: 0, npub: npubEncode(pk) };
        await save('profiles', profile);
      }
      setLoggedInUser(profile);
      updateProfiles([pk], relays(), profiles());
    } else {
      setLoggedInUser();
    }
  });

  // Publishing

  const onSuccess = async (event: Event) => {
    setLoading(false);
    // reset comment & error message
    setComment('');
    setErrorMessage('');

    await save('events', { ...event as Event<1>, anchor: anchor() }, { immediate: true });

    // callback (closes the reply form)
    props.onDone?.call(this);
  };

  const onError = (message: string) => {
    setLoading(false);
    // set error message
    setErrorMessage(message);
  };

  const publish = async (profile?: StoredProfile) => {
    let signer: EventSigner | undefined;
    if (profile) {
      signer = signersStore.external || signersStore.internal;
    } else {
      if (!signersStore.anonymous) {
        const sk = generatePrivateKey();
        signersStore.anonymous = {
          pk: getPublicKey(sk),
          signEvent: async (event) => ({ sig: getSignature(event, sk) }),
        };
      }
      signer = signersStore.anonymous;
    }

    if (!signer?.signEvent) {
      onError('User has no signer!');
      return;
    }

    const content = comment().trim();
    if (!content) return;

    // Ensure root
    let rootTag = tagFor(preferencesStore.filter!);

    if (rootTag.length === 0) {
      const url = anchor();
      const unsignedRootEvent: UnsignedEvent<1> = {
        pubkey: signer.pk,
        created_at: Math.round(Date.now() / 1000),
        kind: 1,
        tags: [['r', url]],
        content: `Comments on ${url} (added by zapthreads) ↴`
      };
      const rootEvent: Event<1> = {
        id: getEventHash(unsignedRootEvent),
        ...unsignedRootEvent,
        ...await signer.signEvent(unsignedRootEvent)
      };

      // Publish, store filter and get updated rootTag
      if (preferencesStore.disable().includes('publish')) {
        pool.publish(relays(), rootEvent);
      } else {
        console.log('Publishing root event disabled', rootEvent);
      }
      // Update filter to own rootEvent
      preferencesStore.filter = { "#e": [rootEvent.id] };
      rootTag = tagFor(preferencesStore.filter!);
    }

    const unsignedEvent: UnsignedEvent<1> = {
      kind: 1,
      created_at: Math.round(Date.now() / 1000),
      content: content,
      pubkey: signer.pk,
      tags: []
    };

    unsignedEvent.tags.push(rootTag);

    // Set reply
    if (props.replyTo) {
      // If the replyTo does not have a reply it means it is at root level
      // const type = props.replyTo.reply?.id != null ? "reply" : "root";
      // TODO restore when root is the article ("a")
      const reply = ["e", props.replyTo, "", "reply"];
      unsignedEvent.tags.push(reply);
    }

    // Add client tag
    unsignedEvent.tags.push(['client', 'zapthreads']);

    const id = getEventHash(unsignedEvent);

    // Attempt to sign the event
    const signature = await signer.signEvent(unsignedEvent);

    const event: Event = { id, ...unsignedEvent, ...signature };

    setLoading(true);
    console.log(JSON.stringify(event, null, 2));

    if (preferencesStore.disable().includes('publish')) {
      // Simulate publishing
      setTimeout(() => onSuccess(event), 1500);
    } else {
      try {
        await Promise.all(pool.publish(relays(), event));
        onSuccess(event);
      } catch (e) {
        onError('Your comment was not published');
        setLoading(false);
      }
    }
  };

  // Only autofocus if 
  const autofocus = props.replyTo !== undefined;
  let ref!: HTMLTextAreaElement;
  createAutofocus(() => {
    return autofocus ? ref : undefined;
  });

  return <div class="ztr-reply-form">
    <textarea
      disabled={loading()}
      value={comment()}
      placeholder='Add your comment...'
      autofocus={autofocus}
      ref={ref}
      onChange={e => setComment(e.target.value)}
    />
    <div class="ztr-reply-controls">
      {preferencesStore.disable().includes('publish') && <span>Publishing is disabled</span>}
      {errorMessage() && <span class="ztr-reply-error">Error: {errorMessage()}</span>}

      <Show when={!loading()} fallback={
        <svg class="ztr-spinner" viewBox="0 0 50 50">
          <circle class="path" cx="25" cy="25" r="20" fill="none" stroke-width="5"></circle>
        </svg>
      }>
        <div class="ztr-comment-info-picture">
          <img src={loggedInUser()?.imgUrl || defaultPicture} />
        </div>
      </Show>

      {loggedInUser() &&
        <button disabled={loading()} class="ztr-reply-button" onClick={() => publish(loggedInUser())}>
          Reply as {loggedInUser()!.name || shortenEncodedId(loggedInUser()!.npub!)}
        </button>}

      {!loggedInUser() && !preferencesStore.disable().includes('replyAnonymously') &&
        <button disabled={loading()} class="ztr-reply-button" onClick={() => publish()}>
          Reply anonymously
        </button>}

      {!loggedInUser() && <button class="ztr-reply-login-button" onClick={() => login('internal')}>Log in</button>}
    </div>
  </div>;
};

export const RootComment = () => {
  const { preferencesStore, anchor } = useContext(ZapThreadsContext)!;

  const zapEvents = watchAll(() => ['events', 'kind+anchor', [9735, anchor()] as [9735, string]]);
  const zapCount = () => zapEvents()!.reduce((acc, e) => acc + (e as ZapEvent).amount, 0);

  const likeEvents = watchAll(() => ['events', 'kind+anchor', [7, anchor()] as [7, string]]);

  return <div class="ztr-comment-new">
    <div class="ztr-comment-body">
      <ul class="ztr-comment-actions">
        <Show when={!preferencesStore.disable().includes('likes')}>
          <li class="ztr-comment-action-like">
            {likeSvg()}
            <span>{likeEvents()!.length} likes</span>
          </li>
        </Show>
        <Show when={!preferencesStore.disable().includes('zaps')}>
          <li class="ztr-comment-action-zap">
            {lightningSvg()}
            <span>{zapCount()} sats</span>
          </li>
        </Show>
      </ul>
      <ReplyEditor />
    </div>
  </div>;
};