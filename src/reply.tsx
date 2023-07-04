import { defaultPicture, shortenEncodedId, tagFor, updateMetadata } from "./util/ui";
import { Show, createEffect, createSignal, on, useContext } from "solid-js";
import { UnsignedEvent, Event, getSignature, getEventHash } from "./nostr-tools/event";
import { EventSigner, pool, User, usersStore, ZapThreadsContext } from "./util/stores";
import { randomCount, svgWidth } from "./util/ui";
import { generatePrivateKey, getPublicKey } from "./nostr-tools/keys";
import { decode, npubEncode } from "./nostr-tools/nip19";
import { createAutofocus } from "@solid-primitives/autofocus";

declare global {
  interface Window {
    nostr?: {
      getPublicKey(): Promise<string>;
      signEvent: EventSigner;
    };
  }
}

export const ReplyEditor = (props: { replyTo?: string; onDone?: Function; }) => {
  const { relays, filter, pubkey, eventsStore, signersStore, preferencesStore } = useContext(ZapThreadsContext)!;

  const [comment, setComment] = createSignal('');
  const [loading, setLoading] = createSignal(false);
  const [errorMessage, setErrorMessage] = createSignal('');

  // Sessions

  const login = async (loginType: 'internal' | 'external') => {
    let pk: string;
    if (pubkey() && loginType == 'external') {
      pk = pubkey()!;
    } else {
      pk = await window.nostr!.getPublicKey();
    }

    usersStore[pk] ||= {
      timestamp: 0,
      npub: npubEncode(pk),
    };

    usersStore[pk].signEvent = async (event) => {
      const extensionPubkey = await window.nostr!.getPublicKey();
      if (loggedInUser()!.npub !== npubEncode(extensionPubkey)) {
        // If zapthreads was passed a different pubkey then throw
        setErrorMessage('Pubkey mismatch');
        throw `Pubkey mismatch: ${loggedInUser()!.npub} !== ${npubEncode(extensionPubkey)}`;
      }
      return window.nostr!.signEvent(event);
    };
    signersStore[loginType] = pk;

    if (!usersStore[pk].name) {
      const result = await pool.list(relays(), [{
        kinds: [0],
        authors: [pk]
      }]);
      updateMetadata(result);
    }
  };

  const loggedInUser = () => {
    const pk = signersStore.external || signersStore.internal;
    if (pk) {
      return usersStore[pk];
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

  const onSuccess = (event: Event<1>) => {
    setLoading(false);
    // reset comment & error message
    setComment('');
    setErrorMessage('');
    // set in store to render
    eventsStore[event.id] = event;
    // callback (closes the reply form)
    props.onDone?.call(this);
  };

  const onError = () => {
    setLoading(false);
    // set error message
    setErrorMessage('Your comment was not published');
  };

  const publish = async (user: User) => {
    if (!user && !usersStore.anonymous) {
      const sk = generatePrivateKey();
      user = usersStore.anonymous = {
        timestamp: 0,
        npub: npubEncode(getPublicKey(sk)),
        signEvent: async (event) => ({ sig: getSignature(event, sk) }),
      };
    }

    if (!user.signEvent) {
      console.log('User has no signer!');
      return;
    }

    const content = comment().trim();
    if (!content) return;

    const unsignedEvent: UnsignedEvent<1> = {
      kind: 1,
      created_at: Math.round(Date.now() / 1000),
      content: content,
      pubkey: decode(user.npub!).data.toString(),
      tags: []
    };

    // Set root
    unsignedEvent.tags.push(tagFor(filter()!));

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
    const signature = await user.signEvent(unsignedEvent);

    const event: Event<1> = { id, ...unsignedEvent, ...signature };

    setLoading(true);
    console.log(JSON.stringify(event, null, 2));

    if (preferencesStore.disablePublish) {
      // Simulate publishing
      setTimeout(() => onSuccess(event), 1500);
    } else {
      const sub = pool.publish(relays(), event);
      // call callbacks and dispose
      // TODO need to summarize relay callbacks in one result
      sub.on('ok', (relay: string) => {
        onSuccess(event);
        sub.off('ok', onSuccess);
      });
      sub.on('failed', (relay: string) => {
        // onError();
        setLoading(false);
        sub.off('failed', onError);
      });
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

      <button disabled={loading()} class="ztr-reply-button" onClick={() => publish(loggedInUser() || usersStore.anonymous)}>
        Reply
        {loggedInUser() ? ` as ${loggedInUser()!.name || shortenEncodedId(loggedInUser()!.npub!)}` : ' anonymously'}
      </button>

      {!loggedInUser() && window.nostr && <button class="ztr-reply-login-button" onClick={() => login('internal')}>Log in</button>}
    </div>
  </div>;
};

export const RootComment = () => {
  const { preferencesStore } = useContext(ZapThreadsContext)!;
  return <div class="ztr-comment-new">
    <div class="ztr-comment-body">
      <ul class="ztr-comment-actions">
        <Show when={!preferencesStore.disableZaps}>
          <li class="ztr-comment-action-zap">
            <a>
              <svg width={svgWidth} height={svgWidth} viewBox="0 -2 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M18,11.74a1,1,0,0,0-.52-.63L14.09,9.43,15,3.14a1,1,0,0,0-1.78-.75l-7,9a1,1,0,0,0-.17.87,1,1,0,0,0,.59.67l4.27,1.71L10,20.86a1,1,0,0,0,.63,1.07A.92.92,0,0,0,11,22a1,1,0,0,0,.83-.45l6-9A1,1,0,0,0,18,11.74Z"></path></svg>
            </a>
            <span>{randomCount() * 11} sats</span>
          </li>
        </Show>
        <Show when={!preferencesStore.disableLikes}>
          <li class="ztr-comment-action-like">
            <a>
              <svg width={svgWidth} height={svgWidth} viewBox="0 -16 180 180" xmlns="http://www.w3.org/2000/svg"><path d="M60.732 29.7C41.107 29.7 22 39.7 22 67.41c0 27.29 45.274 67.29 74 94.89 28.744-27.6 74-67.6 74-94.89 0-27.71-19.092-37.71-38.695-37.71C116 29.7 104.325 41.575 96 54.066 87.638 41.516 76 29.7 60.732 29.7z" /></svg>
            </a>
            <span>{randomCount()} likes</span>
          </li>
        </Show>
      </ul>
      <ReplyEditor />
    </div>
  </div>;
};