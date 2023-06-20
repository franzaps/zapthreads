import { NDKEvent, NDKFilter, NDKNip07Signer, NDKPrivateKeySigner, NDKTag } from "@nostr-dev-kit/ndk";
import { ZapThreadsContext, eventsStore, signersStore, usersStore } from "./ZapThreads";
import { defaultPicture, shortenEncodedId } from "./util";
import { Show, createSignal, useContext } from "solid-js";

export const ReplyEditor = (props: { replyTo?: string; onDone?: Function; }) => {
  const { ndk, filter } = useContext(ZapThreadsContext)!;

  const [comment, setComment] = createSignal('');

  const login = async () => {
    signersStore.default ||= new NDKNip07Signer();

    const u = await signersStore.default.user();
    if (u.npub !== undefined) {
      usersStore.default = { timestamp: 0, npub: u.npub };
      usersStore[u.hexpubkey()] = usersStore.default;
      if (u.profile === undefined) {
        u.ndk = ndk;
        await u.fetchProfile();
        usersStore.default = { ...usersStore.default, name: u.profile!.displayName, imgUrl: u.profile!.image };
        usersStore[u.hexpubkey()] = { timestamp: 0, name: u.profile!.displayName, imgUrl: u.profile!.image };
      }
    } else {
      console.log('DENIED ACCESS');
    }
  };

  const publish = async () => {
    signersStore.anonymous ||= NDKPrivateKeySigner.generate();

    const signer = signersStore.default || signersStore.anonymous;

    const content = comment().trim();
    if (!content) {
      return;
    }

    const event = new NDKEvent(ndk);
    const user = await signer.user();
    event.kind = 1;
    event.created_at = Math.round(Date.now() / 1000);
    event.content = content;
    event.pubkey = user.hexpubkey();
    event.tag(user);

    // Set root
    event.tags.push(tagFor(filter()!));

    // Set reply
    if (props.replyTo) {
      // If the replyTo does not have a reply it means it is at root level
      // const type = props.replyTo.reply?.id != null ? "reply" : "root";
      // TODO restore when root is the article ("a")
      const reply = ["e", props.replyTo, "", "reply"];
      event.tags.push(reply);
    }

    const rawEvent = await event.toNostrEvent();
    await signer.sign(rawEvent);

    console.log(JSON.stringify(rawEvent, null, 2));

    // await event.publish();

    setComment('');

    eventsStore[event.id] = event;
    props.onDone?.call(this);
  };

  return <div class="ctr-reply-form">
    <textarea
      value={comment()}
      placeholder='Add your comment...'
      autofocus={true}
      onChange={e => setComment(e.target.value)}
    />
    <div class="ctr-reply-controls">
      <Show
        when={usersStore.default}
        fallback={<>
          <button class="ctr-reply-button" onClick={() => publish()}>Reply anonymously</button>
          <button class="ctr-reply-login-button" onClick={login}>Log-in</button>
        </>}
      >
        <div class="ctr-comment-info-picture">
          <img src={usersStore.default.imgUrl || defaultPicture} />
        </div>
        <button class="ctr-reply-button" onClick={() => publish()}>Reply as {usersStore.default.name || shortenEncodedId(usersStore.default.npub!)}</button>
      </Show>
    </div>
  </div>;
};

function tagFor(filter: NDKFilter): NDKTag {
  if (filter["#e"]) {
    return ["e", filter["#e"][0], "", "root"];
  } else {
    return ["a", filter["#a"][0], "", "root"];
  }
}
