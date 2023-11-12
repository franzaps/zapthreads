import { defaultPicture, generateTags, shortenEncodedId, updateProfiles } from "./util/ui";
import { Show, createEffect, createSignal, useContext } from "solid-js";
import { UnsignedEvent, Event, getSignature, getEventHash } from "./nostr-tools/event";
import { EventSigner, ZapThreadsContext, pool } from "./util/stores";
import { generatePrivateKey, getPublicKey } from "./nostr-tools/keys";
import { createAutofocus } from "@solid-primitives/autofocus";
import { save, watchAll } from "./util/db";
import { lightningSvg, likeSvg } from "./thread";
import { Profile, eventToNoteEvent } from "./util/models";

export const ReplyEditor = (props: { replyTo?: string; onDone?: Function; }) => {
  const { relays, anchor, profiles, signersStore, preferencesStore } = useContext(ZapThreadsContext)!;

  const [comment, setComment] = createSignal('');
  const [loading, setLoading] = createSignal(false);
  const [loggedInUser, setLoggedInUser] = createSignal<Profile>();
  const [errorMessage, setErrorMessage] = createSignal('');

  // Sessions

  const login = async () => {
    if (!window.nostr) {
      onError('No NIP-07 extension!');
      return;
    }
    const pk = await window.nostr!.getPublicKey();

    signersStore.internal = {
      pk,
      signEvent: async (event) => window.nostr!.signEvent(event)
    };

    onError(''); // clear error
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

  // Publishing

  const onSuccess = async (event: Event) => {
    setLoading(false);
    // reset comment & error message
    setComment('');
    setErrorMessage('');

    await save('events', eventToNoteEvent(event as Event<1>), { immediate: true });

    // callback (closes the reply form)
    props.onDone?.call(this);
  };

  const onError = (message: string) => {
    setLoading(false);
    // set error message
    setErrorMessage(message);
  };

  const publish = async (profile?: Profile) => {
    let signer: EventSigner | undefined;
    if (profile) {
      signer = signersStore.active;
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

    const unsignedEvent: UnsignedEvent<1> = {
      kind: 1,
      created_at: Math.round(Date.now() / 1000),
      content: content,
      pubkey: signer.pk,
      tags: [
        ...generateTags(content), // tags from content
        ['client', 'zapthreads'] // client tag
      ]
    };

    // Establish reference tag (root or reply)

    const filter = preferencesStore.filter;
    const version = preferencesStore.version;

    let referenceTag;

    if (props.replyTo) {
      referenceTag = ['e', props.replyTo, '', 'reply'];
    } else { // it is a root
      // add e tag to reply to a particular replaceable event version
      if (filter['#a'] && version) {
        referenceTag = ['e', version, '', 'root'];
      } else if (filter['#e'] && filter['#e'].length > 0) {
        // this could be for an URL anchor
        referenceTag = ['e', filter['#e'][0], '', 'root'];
      }

      // If no root tag is present, create it to use as anchor
      if (!referenceTag) {
        const url = anchor().value;
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
          console.log('Publishing root event disabled', rootEvent);
        } else {
          pool.publish(relays(), rootEvent);
        }
        // Update filter to this rootEvent
        preferencesStore.filter = { "#e": [rootEvent.id] };
        referenceTag = ['e', rootEvent.id, '', 'root'];
      }
    }

    // Add reference tag (root or reply marker)
    if (referenceTag) {
      unsignedEvent.tags.push(referenceTag);
    }

    // TODO this probably not there
    // Add a tag from replaceable event, if present
    if (filter && filter['#a'] && filter['#a'][0]) {
      unsignedEvent.tags.push(['a', filter['#a'][0]]);
    }

    // TODO Add p tag from note author to notify them ()
    // const contentEvents = await findAll('events', 'anchor', anchor()); ??
    // if (anchorPubkey()) {
    //   unsignedEvent.tags.push(['p', anchorPubkey()!]);
    // }

    const id = getEventHash(unsignedEvent);

    // Attempt to sign the event
    const signature = await signer.signEvent(unsignedEvent);

    const event: Event = { id, ...unsignedEvent, ...signature };

    setLoading(true);
    console.log(JSON.stringify(event, null, 2));

    if (preferencesStore.disable().includes('publish')) {
      // Simulate publishing
      setTimeout(() => onSuccess(event), 1000);
    } else {
      try {
        await Promise.all(pool.publish(relays(), event));
        onSuccess(event);
      } catch (e) {
        onError('Warning: your comment was not published to all relays');
        setLoading(false);
      }
    }
  };

  // Only autofocus if 
  const autofocus = props.replyTo !== undefined;
  let ref!: HTMLTextAreaElement;
  createAutofocus(() => autofocus && ref);

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
          <img src={loggedInUser()?.i || defaultPicture} />
        </div>
      </Show>

      {loggedInUser() &&
        <button disabled={loading()} class="ztr-reply-button" onClick={() => publish(loggedInUser())}>
          Reply as {loggedInUser()!.n || shortenEncodedId(loggedInUser()!.pk)}
        </button>}

      {!loggedInUser() && !preferencesStore.disable().includes('replyAnonymously') &&
        <button disabled={loading()} class="ztr-reply-button" onClick={() => publish()}>
          Reply anonymously
        </button>}

      {!loggedInUser() && <button class="ztr-reply-login-button" onClick={() => login()}>Log in</button>}
    </div>
  </div>;
};

export const RootComment = () => {
  const { preferencesStore, anchor } = useContext(ZapThreadsContext)!;

  // TODO watchAll aggregates until we implement watch
  const aggregateEvents = watchAll(() => ['aggregates']);
  const zapCount = () => aggregateEvents().find(a => a.eid === anchor().value && a.k === 9735)?.sum ?? 0;
  const likeCount = () => {
    return aggregateEvents().find(a => a.eid === anchor().value && a.k === 7)?.ids.length ?? 0;
  };

  return <div class="ztr-comment-new">
    <div class="ztr-comment-body">
      <ul class="ztr-comment-actions">
        <Show when={!preferencesStore.disable().includes('likes')}>
          <li class="ztr-comment-action-like">
            {likeSvg()}
            <span>{likeCount()} likes</span>
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