import { Filter } from "nostr-tools/lib/filter";
import { ZapThreadsContext } from ".";
import { defaultPicture, shortenEncodedId, tagFor, updateMetadata } from "./util/ui";
import { Show, createSignal, useContext } from "solid-js";
import { UnsignedEvent, Event, nip19, generatePrivateKey, getSignature, getPublicKey, getEventHash } from "nostr-tools";
import { EventSigner, User, eventsStore, usersStore, preferencesStore } from "./util/stores";
import { randomCount, svgWidth } from "./util/ui";

declare global {
  interface Window {
    nostr?: {
      getPublicKey(): Promise<string>;
      signEvent: EventSigner;
    };
  }
}

export const ReplyEditor = (props: { replyTo?: string; onDone?: Function; }) => {
  const { pool, relays, filter } = useContext(ZapThreadsContext)!;

  const [comment, setComment] = createSignal('');

  const loggedInUser = () => {
    return Object.values(usersStore).find(u => u.loggedIn === true);
  };

  const login = async () => {
    const pubkey = await window.nostr!.getPublicKey();
    if (pubkey) {
      usersStore[pubkey] = {
        timestamp: 0,
        loggedIn: true,
        npub: nip19.npubEncode(pubkey),
        signEvent: async (event) => window.nostr!.signEvent(event),
      };

      if (!usersStore[pubkey].name) {
        const result = await pool.list(relays, [{
          kinds: [0],
          authors: [pubkey]
        }]);
        updateMetadata(result);
      }
    } else {
      alert('Access was denied');
    }
  };

  const publish = async (user: User) => {
    if (!user && !usersStore.anonymous) {
      const sk = generatePrivateKey();
      user = usersStore.anonymous = {
        timestamp: 0,
        npub: nip19.npubEncode(getPublicKey(sk)),
        signEvent: async (event) => ({ sig: getSignature(event, sk) }),
      };
    }

    if (!user.signEvent) return;

    const content = comment().trim();
    if (!content) return;

    const unsignedEvent: UnsignedEvent<1> = {
      kind: 1,
      created_at: Math.round(Date.now() / 1000),
      content: content,
      pubkey: nip19.decode(user.npub!).data.toString(),
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
    const signature = await user.signEvent(unsignedEvent);

    const event: Event<1> = { id, ...unsignedEvent, ...signature };

    // const sub = pool.publish(relays, event);
    // sub.on('ok', function ok() {
    //   sub.off('ok', ok);
    // });
    // sub.on('failed', function failed() {
    //   sub.off('failed', failed);
    // });

    console.log(JSON.stringify(event, null, 2));
    setComment('');
    eventsStore[event.id] = event;

    props.onDone?.call(this);
  };

  return <div class="ztr-reply-form">
    <textarea
      value={comment()}
      placeholder='Add your comment...'
      autofocus={true}
      onChange={e => setComment(e.target.value)}
    />
    <div class="ztr-reply-controls">
      <Show
        when={loggedInUser()}
        fallback={<>
          <button class="ztr-reply-button" onClick={() => publish(usersStore.anonymous)}>Reply anonymously</button>
          {window.nostr && <button class="ztr-reply-login-button" onClick={login}>Log-in</button>}
        </>}
      >
        <div class="ztr-comment-info-picture">
          <img src={loggedInUser()!.imgUrl || defaultPicture} />
        </div>
        <button class="ztr-reply-button" onClick={() => publish(loggedInUser()!)}>Reply as {loggedInUser()!.name || shortenEncodedId(loggedInUser()!.npub!)}</button>
      </Show>
    </div>
  </div>;
};

export const RootComment = () => {
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