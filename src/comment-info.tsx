import { Accessor, createEffect, createSignal } from "solid-js";
import { defaultPicture, shortenEncodedId, svgWidth, timeAgo, totalChildren } from "./util/ui";
import { nip19 } from "nostr-tools";
import { NestedNote } from "./util/nest";
import { usersStore } from "./util/stores";

export const CommentInfo = (props: { event: Accessor<NestedNote>; }) => {
  const [profilePicture, setProfilePicture] = createSignal(defaultPicture);

  const pubkey = () => props.event().pubkey;
  const npub = () => nip19.npubEncode(pubkey());

  createEffect(async () => {
    usersStore[pubkey()] ||= { timestamp: 0, npub: npub() };
    const imgUrl = usersStore[pubkey()]?.imgUrl;
    setProfilePicture(imgUrl || defaultPicture);
  });

  return <div class="ctr-comment-info">
    <div class="ctr-comment-info-picture">
      <img width={svgWidth} height={svgWidth} src={profilePicture()} onerror={() => setProfilePicture(defaultPicture)} />
    </div>
    <ul class="ctr-comment-info-items">
      <li class="ctr-comment-info-item ctr-comment-info-author">
        <a href={'https://nostr.com/' + npub()} target="_blank" >{usersStore[pubkey()]?.name || shortenEncodedId(npub())}</a>
      </li>
      <li class="ctr-comment-info-item ctr-comment-info-time">{timeAgo(props.event().created_at! * 1000)}</li>
      <li class="ctr-comment-info-item ctr-comment-info-replies">{totalChildren(props.event()) == 1 ? '1 reply' : `${totalChildren(props.event())} replies`}</li>
    </ul>
  </div>;
};