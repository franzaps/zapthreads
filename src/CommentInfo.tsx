import { NDKNestedEvent } from "@nostr-dev-kit/ndk";
import { Accessor, createEffect, createSignal, useContext } from "solid-js";
import { defaultPicture, svgWidth, timeAgo, userDisplay } from "./util";
import { usersStore } from "./ZapThreads";

export const CommentInfo = (props: { event: Accessor<NDKNestedEvent>; }) => {
  const [profilePicture, setProfilePicture] = createSignal(defaultPicture);

  const npub = () => props.event().author.npub;
  const pubkey = () => props.event().author.hexpubkey();

  createEffect(async () => {
    const a = props.event().author;
    usersStore[a.hexpubkey()] ||= { timestamp: 0, npub: a.npub };

    const imgUrl = usersStore[a.hexpubkey()]?.imgUrl;
    setProfilePicture(imgUrl || defaultPicture);
  });

  return <div class="ctr-comment-info">
    <div class="ctr-comment-info-picture">
      <img width={svgWidth} height={svgWidth} src={profilePicture()} onerror={() => setProfilePicture(defaultPicture)} />
    </div>
    <ul class="ctr-comment-info-items">
      <li class="ctr-comment-info-item ctr-comment-info-author">
        <a href={'https://nostr.com/' + npub()} target="_blank" >{userDisplay(npub(), usersStore[pubkey()]?.name)}</a>
      </li>
      <li class="ctr-comment-info-item ctr-comment-info-time">{timeAgo(props.event().created_at! * 1000)}</li>
      <li class="ctr-comment-info-item ctr-comment-info-replies">{props.event().totalChildren() == 1 ? '1 reply' : `${props.event().totalChildren()} replies`}</li>
    </ul>
  </div>;
};