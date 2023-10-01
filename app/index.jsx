/* @refresh reload */
import { render } from 'solid-js/web';

import './style.css';
import '../src';
// import ZapThreads from '../src';
import { createSignal } from 'solid-js';
import { Select } from "@thisbeyond/solid-select";
import "@thisbeyond/solid-select/style.css";

const root = document.getElementById('root');

if (import.meta.env.DEV && !(root instanceof HTMLElement)) {
  throw new Error(
    'Root element not found. Did you forget to add it to your index.html? Or maybe the id attribute got mispelled?',
  );
}

const options = [
  { label: "Gigi article", name: "naddr1qqxnzd3cxqmrzv3exgmr2wfeqgsxu35yyt0mwjjh8pcz4zprhxegz69t4wr9t74vk6zne58wzh0waycrqsqqqa28pjfdhz" },
  { label: "fiatjaf blog", name: "https://fiatjaf.com/nostr.html" },
  { label: "Jack article", name: "naddr1qqxnzd3cxyerxd3h8qerwwfcqgsgydql3q4ka27d9wnlrmus4tvkrnc8ftc4h8h5fgyln54gl0a7dgsrqsqqqa28387u5u"},
  { label: "Tony article", name: "naddr1qqxnzd3cxy6rjv3hx5cnyde5qy88wumn8ghj7mn0wvhxcmmv9uq3uamnwvaz7tmwdaehgu3dwp6kytnhv4kxcmmjv3jhytnwv46z7qg3waehxw309ahx7um5wgh8w6twv5hszymhwden5te0danxvcmgv95kutnsw43z7qglwaehxw309ahx7um5wgkhyetvv9ujumn0ddhhgctjduhxxmmd9upzql6u9d8y3g8flm9x8frtz0xmsfyf7spq8xxkpgs8p2tge25p346aqvzqqqr4gukz494x"},
  { label: "Cholesterol tag bug", name: "naddr1qq2kj3nvwf2xsh63dyc8sm35xdy8q7282pgkjq3qtta8zx3wfazjjnyu4qpnscdqu9dg08n0cxj2dypkgrml46hq67uqxpqqqp65wwk6pht"},
  { label: "Running zapthreads note", name: "note1nndua46su6c7zf6t0h68edpn74j5znws3jyhzelt5as74hhgg8xq4qmzwn"},
  { label: "Random highlight", name: "nevent1qqsprhvdfau2ezh6mjpess9g5v6g9c657j99jke04s3hc7xrv4vve4qzypl62m6ad932k83u6sjwwkxrqq4cve0hkrvdem5la83g34m4rtqegx3l8d3"},
  { label: "An nevent by thepurpose", name: "nevent1qqsz3e0y8qqw32qa50awy83lctpey3npgaq4mgv4jesqwdpge64z5wspr3mhxue69uhkummnw3ez6vp39e3x7mr59ehkyum9wfmx2uspz3mhxue69uhhyetvv9ujuerpd46hxtnfdupmk2rc"},
  { label: "Habla crowdfunding", name: "note17atrwgclprsqlskylp655saavazgmc7du6e3rrpxehd6qehnggzqnat5tp"}
];

const relays = ["wss://relay.damus.io", "wss://eden.nostr.land"];
const otherRelays = ['wss://relay.damus.io', 'wss://nostr.mom', 'wss://nos.lol']

const defaultNpub = "npub1wf4pufsucer5va8g9p0rj5dnhvfeh6d8w0g6eayaep5dhps6rsgs43dgh9";
const altNpub = "npub1dergggklka99wwrs92yz8wdjs952h2ux2ha2ed598ngwu9w7a6fsh9xzpc";

render(() => {  
  const [npub, setNpub] = createSignal(defaultNpub);
  const [anchor, setAnchor] = createSignal('');

  return <>
    <h1>Super Blog</h1>
    <h2>Sample article</h2>
    <p>
      {npub() && <span>Logged in as {npub()}</span>}
    </p>
    <button onClick={() => npub() ? setNpub('') : setNpub(defaultNpub)}>{npub() ? 'Log out' : 'Log in'}</button>
    <hr/>

    <Select class="custom" initialValue={options[4]} options={options} format={(item) => item.label} onChange={(e) => setAnchor(e.name)} />

    <hr/>
    <p>
    Lorem ipsum dolor sit amet, consectetur adipisicing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum. Lorem ipsum dolor sit amet, consectetur adipisicing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.
    </p>
    
    {/* solid component */}
    {/* <ZapThreads anchor={tonyArticle} relays={['wss://relay.damus.io']} disable={'likes'} npub={npub()} /> */}
    {/* web component */}
    {anchor() && <zap-threads anchor={anchor()} disable="publish" npub={npub()} />}
  </>
}, root);
