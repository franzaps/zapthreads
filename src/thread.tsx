import { Accessor, Index, Signal, createEffect, createSignal, onCleanup, useContext } from "solid-js";
import { defaultPicture, parseContent, shortenEncodedId, svgWidth, timeAgo, totalChildren } from "./util/ui";
import { ReplyEditor } from "./reply";
import { NestedNote } from "./util/nest";
import { StoredProfile, ZapThreadsContext } from "./util/stores";
import { npubEncode } from "./nostr-tools/nip19";
import { createElementSize } from "@solid-primitives/resize-observer";

export const Thread = (props: { nestedEvents: () => NestedNote[]; }) => {
  const { anchor, preferencesStore, profiles } = useContext(ZapThreadsContext)!;

  return <div class="ztr-thread">
    <Index each={sortByDate(props.nestedEvents())}>
      {
        (event) => {
          const [isOpen, setOpen] = createSignal(false);
          const [isExpanded, setExpanded] = createSignal(false);
          const collapsedSignal = createSignal(false);
          const [isThreadCollapsed] = collapsedSignal;
          const infoSignal = createSignal(false);
          const [showInfo, setShowInfo] = infoSignal;

          const MAX_HEIGHT = 500;
          const [target, setTarget] = createSignal<HTMLElement>();
          const size = createElementSize(target);

          const total = () => totalChildren(event());

          return <div class="ztr-comment">
            <div class="ztr-comment-body">
              <CommentInfo event={event} profiles={profiles()} collapsedSignal={collapsedSignal} infoSignal={infoSignal} />
              <div ref={setTarget} class="ztr-comment-text" style={!isExpanded() ? { 'max-height': `${MAX_HEIGHT}px` } : {}} innerHTML={parseContent(event(), profiles(), anchor(), preferencesStore)}>
              </div>

              {size.height && size.height >= MAX_HEIGHT && !isExpanded() &&
                <div class="ztr-comment-expand">
                  <a style={{ 'height': `${svgWidth}px` }}>
                    {expandSvg()}
                  </a>
                  <span onClick={() => setExpanded(true)}>Show full comment</span>
                </div>}

              <ul class="ztr-comment-actions">
                <li class="ztr-comment-action-reply" onClick={() => setOpen(!isOpen()) && setShowInfo(false)}>
                  {replySvg()}
                  <span>{total()}</span>
                </li>
                {/* <Show when={!preferencesStore.disableZaps}>
                  <li class="ztr-comment-action-zap">
                    {lightningSvg()}
                    <span>10</span>
                  </li>
                </Show>
                <Show when={!preferencesStore.disableLikes}>
                  <li class="ztr-comment-action-like">
                    {likeSvg()}
                    <span>27</span>
                  </li>
                </Show> */}
              </ul>
              {isOpen() &&
                <ReplyEditor replyTo={event().id} onDone={() => setOpen(false)} />}
              {showInfo() &&
                <div class="ztr-info-pane">
                  <pre>{JSON.stringify(event(), ['id', 'created_at', 'pubkey', 'tags'], 2)}</pre>
                  <button onClick={() => setShowInfo(false)}>Hide info</button>
                </div>}
            </div>
            {!isThreadCollapsed() && <div class="ztr-comment-replies">
              <Thread nestedEvents={() => event().children} />
            </div>}
          </div>;
        }
      }
    </Index>
  </div>;
};

const CommentInfo = (props: { event: Accessor<NestedNote>, profiles: StoredProfile[], collapsedSignal: Signal<boolean>, infoSignal: Signal<boolean>; }) => {
  const { preferencesStore } = useContext(ZapThreadsContext)!;
  const [profilePicture, setProfilePicture] = createSignal(defaultPicture);

  const pubkey = () => props.event().pubkey;
  const npub = () => npubEncode(pubkey());
  const [showInfo, setShowInfo] = props.infoSignal;
  const [isThreadCollapsed, setThreadCollapsed] = props.collapsedSignal;
  const profile = () => props.profiles.find(p => p.pubkey === pubkey());

  createEffect(async () => {
    setProfilePicture(profile()?.imgUrl || defaultPicture);
  });

  // Update createdAt every minute
  let timer: any;
  const createdAt = () => timeAgo(props.event().created_at! * 1000);
  const [createdTimeAgo, setCreatedTimeAgo] = createSignal<string>();

  createEffect(() => {
    setCreatedTimeAgo(createdAt());
    timer = setInterval(() => {
      setCreatedTimeAgo(createdAt());
    }, 60 * 1000);
  });

  onCleanup(() => clearInterval(timer));

  return <div class="ztr-comment-info-wrapper">
    <div class="ztr-comment-info">
      <div class="ztr-comment-info-picture">
        <img width={svgWidth} height={svgWidth} src={profilePicture()} onerror={() => setProfilePicture(defaultPicture)} />
      </div>
      <ul class="ztr-comment-info-items">
        <li class="ztr-comment-info-author">
          <a href={preferencesStore.urlPrefixes.npub + npub()} target="_blank" >{profile()?.name || shortenEncodedId(npub())}</a>
        </li>
        <li>{createdTimeAgo()}</li>
        <li>
          <a class="ztr-comment-info-dots" onClick={() => setShowInfo(!showInfo())}>
            {ellipsisSvg()}
          </a>
        </li>
      </ul>
    </div>
    <ul class="ztr-comment-info-items">
      {props.event().children.length > 0 && <li>
        <span onClick={() => setThreadCollapsed(!isThreadCollapsed())}>
          {isThreadCollapsed() ? rightArrow() : downArrow()}
        </span>
      </li>}
    </ul>
  </div>;
};

const sortByDate = (arr: NestedNote[]) => arr.sort((a, b) => (a.created_at || 0) >= (b.created_at || 0)
  ? -1
  : 1);

// SVG

const separatorSvg = () => <svg class="ztr-comment-info-separator" xmlns="http://www.w3.org/2000/svg" width="8" height="8" viewBox="0 0 16 16">
  <circle cx="6" cy="6" r="6" />
</svg>;

const replySvg = () => <svg width={svgWidth} height={svgWidth} viewBox="0 -6 60 60" xmlns="http://www.w3.org/2000/svg"><path d="M 12.6030 50.4905 C 13.3758 50.4905 13.9307 50.1140 14.8621 49.2421 L 20.6483 43.8720 C 19.5188 42.9803 18.6073 41.5733 18.6073 38.3433 L 18.6073 25.2052 C 18.6073 19.1217 22.3129 15.5152 28.3766 15.5152 L 42.2479 15.5152 L 42.2281 14.7622 C 41.9306 10.6999 39.2557 8.0643 34.7177 8.0643 L 7.5301 8.0643 C 2.9922 8.0643 0 10.7791 0 15.4954 L 0 34.9548 C 0 39.6710 2.9922 42.7028 7.5301 42.7028 L 10.8195 42.7028 L 10.8195 48.4693 C 10.8195 49.6979 11.4735 50.4905 12.6030 50.4905 Z M 44.6058 53.2450 C 45.7353 53.2450 46.3895 52.4325 46.3895 51.2237 L 46.3895 45.4374 L 48.4702 45.4374 C 53.0078 45.4374 56 42.4056 56 37.7092 L 56 25.6610 C 56 20.9250 53.0078 18.2300 48.4702 18.2300 L 28.8522 18.2300 C 24.1161 18.2300 21.3221 20.9250 21.3221 25.6610 L 21.3221 37.7092 C 21.3221 42.4056 24.1161 45.4374 28.8522 45.4374 L 35.1735 45.4374 L 42.3470 51.9767 C 43.2784 52.8487 43.8331 53.2450 44.6058 53.2450 Z" /></svg>;
export const lightningSvg = () => <svg xmlns="http://www.w3.org/2000/svg" width={svgWidth} height={svgWidth} viewBox="-120 -80 528 588"><path d="M349.4 44.6c5.9-13.7 1.5-29.7-10.6-38.5s-28.6-8-39.9 1.8l-256 224c-10 8.8-13.6 22.9-8.9 35.3S50.7 288 64 288H175.5L98.6 467.4c-5.9 13.7-1.5 29.7 10.6 38.5s28.6 8 39.9-1.8l256-224c10-8.8 13.6-22.9 8.9-35.3s-16.6-20.7-30-20.7H272.5L349.4 44.6z" /></svg>;
export const likeSvg = () => <svg width={svgWidth} height={svgWidth} viewBox="0 -16 180 180" xmlns="http://www.w3.org/2000/svg"><path d="M60.732 29.7C41.107 29.7 22 39.7 22 67.41c0 27.29 45.274 67.29 74 94.89 28.744-27.6 74-67.6 74-94.89 0-27.71-19.092-37.71-38.695-37.71C116 29.7 104.325 41.575 96 54.066 87.638 41.516 76 29.7 60.732 29.7z" /></svg>;

const expandSvg = () => <svg width={svgWidth} height={svgWidth} viewBox="0 0 576 512"><path d="M168 80c-13.3 0-24 10.7-24 24V408c0 8.4-1.4 16.5-4.1 24H440c13.3 0 24-10.7 24-24V104c0-13.3-10.7-24-24-24H168zM72 480c-39.8 0-72-32.2-72-72V112C0 98.7 10.7 88 24 88s24 10.7 24 24V408c0 13.3 10.7 24 24 24s24-10.7 24-24V104c0-39.8 32.2-72 72-72H440c39.8 0 72 32.2 72 72V408c0 39.8-32.2 72-72 72H72zM176 136c0-13.3 10.7-24 24-24h96c13.3 0 24 10.7 24 24v80c0 13.3-10.7 24-24 24H200c-13.3 0-24-10.7-24-24V136zm200-24h32c13.3 0 24 10.7 24 24s-10.7 24-24 24H376c-13.3 0-24-10.7-24-24s10.7-24 24-24zm0 80h32c13.3 0 24 10.7 24 24s-10.7 24-24 24H376c-13.3 0-24-10.7-24-24s10.7-24 24-24zM200 272H408c13.3 0 24 10.7 24 24s-10.7 24-24 24H200c-13.3 0-24-10.7-24-24s10.7-24 24-24zm0 80H408c13.3 0 24 10.7 24 24s-10.7 24-24 24H200c-13.3 0-24-10.7-24-24s10.7-24 24-24z" /></svg>;
const ellipsisSvg = () => <svg xmlns="http://www.w3.org/2000/svg" width={svgWidth} height={svgWidth} viewBox="0 -200 560 640"><path d="M8 256a56 56 0 1 1 112 0A56 56 0 1 1 8 256zm160 0a56 56 0 1 1 112 0 56 56 0 1 1 -112 0zm216-56a56 56 0 1 1 0 112 56 56 0 1 1 0-112z" /></svg>;
const rightArrow = () => <svg xmlns="http://www.w3.org/2000/svg" width={svgWidth * 0.7} height={svgWidth * 0.7} viewBox="0 -50 256 512"><path d="M246.6 278.6c12.5-12.5 12.5-32.8 0-45.3l-128-128c-9.2-9.2-22.9-11.9-34.9-6.9s-19.8 16.6-19.8 29.6l0 256c0 12.9 7.8 24.6 19.8 29.6s25.7 2.2 34.9-6.9l128-128z" /></svg>;
const downArrow = () => <svg xmlns="http://www.w3.org/2000/svg" width={svgWidth * 0.7} height={svgWidth * 0.7} viewBox="0 -50 320 512"><path d="M137.4 374.6c12.5 12.5 32.8 12.5 45.3 0l128-128c9.2-9.2 11.9-22.9 6.9-34.9s-16.6-19.8-29.6-19.8L32 192c-12.9 0-24.6 7.8-29.6 19.8s-2.2 25.7 6.9 34.9l128 128z" /></svg>;