import { For, createSignal } from 'solid-js';
import '../../src/index.tsx'; // zapthreads
import './App.css';

import { Select } from "@thisbeyond/solid-select";
import "@thisbeyond/solid-select/style.css";

const options = [
  { label: "Purple Text, Orange Highlights (article by Gigi)", name: "naddr1qqxnzd3cxqmrzv3exgmr2wfeqgsxu35yyt0mwjjh8pcz4zprhxegz69t4wr9t74vk6zne58wzh0waycrqsqqqa28pjfdhz" },
  { label: "Nostr (fiatjaf's blog)", name: "https://fiatjaf.com/nostr.html" },
  { label: "A native internet protocol for social media (article by Jack)", name: "naddr1qqxnzd3cxyerxd3h8qerwwfcqgsgydql3q4ka27d9wnlrmus4tvkrnc8ftc4h8h5fgyln54gl0a7dgsrqsqqqa28387u5u" },
  { label: "21ideas article", name: "https://21ideas.org/cena/1/#%D0%B5%D1%81%D1%82%D1%8C-%D0%BB%D0%B8-%D0%B0%D0%BB%D1%8C%D1%82%D0%B5%D1%80%D0%BD%D0%B0%D1%82%D0%B8%D0%B2%D0%B0" },
  { label: "Welcome to Nostr (by Tony)", name: "naddr1qqxnzd3cxy6rjv3hx5cnyde5qy88wumn8ghj7mn0wvhxcmmv9uq3uamnwvaz7tmwdaehgu3dwp6kytnhv4kxcmmjv3jhytnwv46z7qg3waehxw309ahx7um5wgh8w6twv5hszymhwden5te0danxvcmgv95kutnsw43z7qglwaehxw309ahx7um5wgkhyetvv9ujumn0ddhhgctjduhxxmmd9upzql6u9d8y3g8flm9x8frtz0xmsfyf7spq8xxkpgs8p2tge25p346aqvzqqqr4gukz494x" },
  { label: "Fuck this dystopia (note by Odell)", name: "note15fp4nxx0du93y9r3xp33p4zljqmq6lr8c4xls46gftkl7ul4vhdq484wr8" },
  { label: "Random highlight", name: "nevent1qqsprhvdfau2ezh6mjpess9g5v6g9c657j99jke04s3hc7xrv4vve4qzypl62m6ad932k83u6sjwwkxrqq4cve0hkrvdem5la83g34m4rtqegx3l8d3" },
  { label: "Habla crowdfunding", name: "note17atrwgclprsqlskylp655saavazgmc7du6e3rrpxehd6qehnggzqnat5tp" },
  { label: "Broken resource", name: "borked" }
];

const sizes = [
  { label: "small", name: "14px" },
  { label: "medium", name: "17px" },
  { label: "large", name: "21px" },
];

const defaultNpub = "npub1wf4pufsucer5va8g9p0rj5dnhvfeh6d8w0g6eayaep5dhps6rsgs43dgh9";
const altNpub = "npub1dergggklka99wwrs92yz8wdjs952h2ux2ha2ed598ngwu9w7a6fsh9xzpc";
const nsec = "nsec14cp0lpl34rs3c7wmtg6lvgdndzafavlsjuhnq9zp7v05pqruxp4q9vuh9r";

function App() {
  const [npub, setNpub] = createSignal(); // defaultNpub
  const [anchor, setAnchor] = createSignal('');
  const [size, setSize] = createSignal('18px');
  const [disabled, setDisabled] = createSignal(['publish']);
  const [relays, setRelays] = createSignal('wss://relay.damus.io,wss://relay.nostr.band,wss://relay.primal.net,wss://nos.lol');

  const css = () => `:root { --ztr-font-size: ${size()}; }`;

  return <>
    <style>{css}</style>
    <a class="github-fork-ribbon" href="https://github.com/fr4nzap/zapthreads" data-ribbon="Code on GitHub" title="Code on GitHub">Code on GitHub</a>
    <h1 style={"display: flex; justify-content: center;"}>zap<svg xmlns="http://www.w3.org/2000/svg" viewBox="-75 0 600 600"><path d="M349.4 44.6c5.9-13.7 1.5-29.7-10.6-38.5s-28.6-8-39.9 1.8l-256 224c-10 8.8-13.6 22.9-8.9 35.3S50.7 288 64 288H175.5L98.6 467.4c-5.9 13.7-1.5 29.7 10.6 38.5s28.6 8 39.9-1.8l256-224c10-8.8 13.6-22.9 8.9-35.3s-16.6-20.7-30-20.7H272.5L349.4 44.6z" /></svg>threads</h1>

    {/* <p>
      {npub() && <span>Logged in as {npub()}</span>}
    </p>
    <button onClick={() => npub() ? setNpub('') : setNpub(defaultNpub)}>{npub() ? 'Log out' : 'Log in'}</button>
    <hr /> */}

    <h3>Select a resource: &nbsp;
      <Select class="custom" initialValue={options[0]} options={options} format={(item) => item.label} onChange={(e) => setAnchor(e.name)} />
    </h3>
    <h3>(or input your own) &nbsp;<input type='text' value={anchor()} onChange={(e) => setAnchor(e.target.value)}></input></h3>

    <For each={['publish', 'likes', 'zaps', 'reply', 'replyAnonymously']}>
      {feature => <label><input type="checkbox" checked={disabled().includes(feature)} onChange={(e) => {
        if (e.target.checked) {
          setDisabled([...disabled(), feature]);
        } else {
          setDisabled(disabled().filter(e => e !== feature));
        }
      }} />Disable {feature}</label>}
    </For>

    <span>Size: &nbsp;
      <Select class="custom" initialValue={sizes[1]} options={sizes} format={(i) => i.label} onChange={(e) => setSize(e.name)} />
    </span>

    <h3>Relays: <input type='text' value={relays()} onChange={(e) => setRelays(e.target.value)}></input></h3>

    <div style="min-height: 1000px; min-width: 700px; margin-top: -2rem">
      {anchor() && <zap-threads reply-placeholder='Write something...' anchor={anchor()} mode="chat" disable={disabled().join(',')} relays={relays()} user={npub()} />}
    </div>
  </>;
}

export default App;
