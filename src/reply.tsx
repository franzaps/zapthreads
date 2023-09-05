import { defaultPicture, shortenEncodedId, tagFor, updateMetadata } from "./util/ui";
import { Show, createEffect, createSignal, on, useContext } from "solid-js";
import { UnsignedEvent, Event, getSignature, getEventHash } from "./nostr-tools/event";
import { EventSigner, pool, StoredProfile, ZapEvent, ZapThreadsContext } from "./util/stores";
import { svgWidth } from "./util/ui";
import { generatePrivateKey, getPublicKey } from "./nostr-tools/keys";
import { npubEncode } from "./nostr-tools/nip19";
import { createAutofocus } from "@solid-primitives/autofocus";
import { find, save, watchAll } from "./util/db";

export const ReplyEditor = (props: { replyTo?: string; onDone?: Function; }) => {
  const { relays, anchor, pubkey, signersStore, preferencesStore } = useContext(ZapThreadsContext)!;

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
      pk = await window.nostr!.getPublicKey();
    }

    const profile = await find('profiles', pk);
    if (!profile) {
      await save('profiles', { pubkey: pk, timestamp: 0, npub: npubEncode(pk) });
    }

    signersStore[loginType] = {
      pk,
      signEvent: async (event) => {
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

    const signer = signersStore.external || signersStore.internal;
    if (signer?.pk) {
      setLoggedInUser(await find('profiles', signer.pk));
    }

    if (!profile?.name) {
      const result = await pool.list(relays(), [{
        kinds: [0],
        authors: [pk]
      }]);
      updateMetadata(result);
    }
  };

  // Auto login when external pubkey supplied
  createEffect(() => {
    if (pubkey() && !signersStore.external) {
      login('external');
    }
  });

  // Log out when external pubkey is absent
  createEffect(on(pubkey, (pubkey) => {
    if (!pubkey && signersStore.external) {
      signersStore.external = undefined;
      signersStore.internal = undefined;

      // reset error message
      setErrorMessage('');
    }
  }, { defer: true }));

  // Publishing

  const onSuccess = (event: Event) => {
    setLoading(false);
    // reset comment & error message
    setComment('');
    setErrorMessage('');
    // set in store to render
    // find root and get note ID from there
    const rootTag = event.tags.findLast(t => t[3] === 'root')!;
    const id = rootTag[1];

    // TODO FIX
    // setEventsStore(produce((s) => {
    //   s[id] ||= [];
    // });

    // eventsStore[id][event.id] = event;
    // callback (closes the reply form)
    props.onDone?.call(this);
  };

  const onError = () => {
    setLoading(false);
    // set error message
    setErrorMessage('Your comment was not published');
  };

  const publish = async (signingPubkey?: string) => {
    let signer: EventSigner | undefined;
    if (!signingPubkey && !signersStore.anonymous) {
      const sk = generatePrivateKey();
      signer = signersStore.anonymous = {
        pk: getPublicKey(sk),
        signEvent: async (event) => ({ sig: getSignature(event, sk) }),
      };
      signingPubkey = signer.pk;
    }

    if (!signer?.signEvent) {
      console.log('User has no signer!');
      return;
    }

    const content = comment().trim();
    if (!content) return;

    // Ensure root
    let rootTag = tagFor(preferencesStore.filter!);

    if (rootTag.length === 0) {
      const url = anchor();
      const unsignedRootEvent: UnsignedEvent<1> = {
        pubkey: signingPubkey!,
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
      if (preferencesStore.disablePublish === false) {
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
      pubkey: signingPubkey!,
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

    const id = getEventHash(unsignedEvent);

    // Attempt to sign the event
    const signature = await signer.signEvent(unsignedEvent);

    const event: Event = { id, ...unsignedEvent, ...signature };

    setLoading(true);
    console.log(JSON.stringify(event, null, 2));

    if (preferencesStore.disablePublish) {
      // Simulate publishing
      setTimeout(() => onSuccess(event), 1500);
    } else {
      try {
        await pool.publish(relays(), event);
        onSuccess(event);
      } catch (e) {
        // onError();
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
      {preferencesStore.disablePublish && <span>Publishing is disabled</span>}
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

      <button disabled={loading()} class="ztr-reply-button" onClick={() => publish(loggedInUser()?.pubkey)}>
        Reply
        {loggedInUser() ? ` as ${loggedInUser()!.name || shortenEncodedId(loggedInUser()!.npub!)}` : ' anonymously'}
      </button>

      {!loggedInUser() && window.nostr && <button class="ztr-reply-login-button" onClick={() => login('internal')}>Log in</button>}
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
        <Show when={!preferencesStore.disableLikes}>
          <li class="ztr-comment-action-like">
            <a>
              <svg width={svgWidth} height={svgWidth} viewBox="0 -16 180 180" xmlns="http://www.w3.org/2000/svg"><path d="M60.732 29.7C41.107 29.7 22 39.7 22 67.41c0 27.29 45.274 67.29 74 94.89 28.744-27.6 74-67.6 74-94.89 0-27.71-19.092-37.71-38.695-37.71C116 29.7 104.325 41.575 96 54.066 87.638 41.516 76 29.7 60.732 29.7z" /></svg>
            </a>
            <span>{likeEvents()!.length} likes</span>
          </li>
        </Show>
        <Show when={!preferencesStore.disableZaps}>
          <li class="ztr-comment-action-zap">
            <a>
              <svg width={svgWidth} height={svgWidth} viewBox="0 -2 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M18,11.74a1,1,0,0,0-.52-.63L14.09,9.43,15,3.14a1,1,0,0,0-1.78-.75l-7,9a1,1,0,0,0-.17.87,1,1,0,0,0,.59.67l4.27,1.71L10,20.86a1,1,0,0,0,.63,1.07A.92.92,0,0,0,11,22a1,1,0,0,0,.83-.45l6-9A1,1,0,0,0,18,11.74Z"></path></svg>
            </a>
            <span>{zapCount()} sats</span>
          </li>
        </Show>
      </ul>
      <ReplyEditor />
    </div>
  </div>;
};