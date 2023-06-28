import { Show } from "solid-js";
import { ReplyEditor } from "./reply-editor";
import { randomCount, svgWidth } from "./util/ui";
import { preferencesStore } from "./util/stores";

export const RootComment = () => {
  return <div class="ctr-comment-new">
    <div class="ctr-comment-body">
      <ul class="ctr-comment-actions">
        <Show when={!preferencesStore.disableZaps}>
          <li class="ctr-comment-action-zap">
            <a>
              <svg width={svgWidth} height={svgWidth} viewBox="0 -2 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M18,11.74a1,1,0,0,0-.52-.63L14.09,9.43,15,3.14a1,1,0,0,0-1.78-.75l-7,9a1,1,0,0,0-.17.87,1,1,0,0,0,.59.67l4.27,1.71L10,20.86a1,1,0,0,0,.63,1.07A.92.92,0,0,0,11,22a1,1,0,0,0,.83-.45l6-9A1,1,0,0,0,18,11.74Z"></path></svg>
            </a>
            <span>{randomCount() * 11} sats</span>
          </li>
        </Show>
        <Show when={!preferencesStore.disableLikes}>
          <li class="ctr-comment-action-like">
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