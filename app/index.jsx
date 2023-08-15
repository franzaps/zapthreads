/* @refresh reload */
import { render } from 'solid-js/web';

import './style.css';
import '../src/styles/index.css';
import '../src';
import ZapThreads from '../src';
import { createSignal } from 'solid-js';

const root = document.getElementById('root');

if (import.meta.env.DEV && !(root instanceof HTMLElement)) {
  throw new Error(
    'Root element not found. Did you forget to add it to your index.html? Or maybe the id attribute got mispelled?',
  );
}

const fiatjafUrl = "https://fiatjaf.com/nostr.html";
const gigiArticle = "naddr1qqxnzd3cxqmrzv3exgmr2wfeqgsxu35yyt0mwjjh8pcz4zprhxegz69t4wr9t74vk6zne58wzh0waycrqsqqqa28pjfdhz";
const tonyArticle = "naddr1qqxnzd3cxy6rjv3hx5cnyde5qy88wumn8ghj7mn0wvhxcmmv9uq3uamnwvaz7tmwdaehgu3dwp6kytnhv4kxcmmjv3jhytnwv46z7qg3waehxw309ahx7um5wgh8w6twv5hszymhwden5te0danxvcmgv95kutnsw43z7qglwaehxw309ahx7um5wgkhyetvv9ujumn0ddhhgctjduhxxmmd9upzql6u9d8y3g8flm9x8frtz0xmsfyf7spq8xxkpgs8p2tge25p346aqvzqqqr4gukz494x";
const jackArticle = "naddr1qqxnzd3cxyerxd3h8qerwwfcqgsgydql3q4ka27d9wnlrmus4tvkrnc8ftc4h8h5fgyln54gl0a7dgsrqsqqqa28387u5u";
const someNote = "note1nndua46su6c7zf6t0h68edpn74j5znws3jyhzelt5as74hhgg8xq4qmzwn";
const highlightEvent = "nevent1qqsprhvdfau2ezh6mjpess9g5v6g9c657j99jke04s3hc7xrv4vve4qzypl62m6ad932k83u6sjwwkxrqq4cve0hkrvdem5la83g34m4rtqegx3l8d3";

const relays = ["wss://relay.damus.io", "wss://eden.nostr.land"];
const moreRelays = ['wss://relay.damus.io', 'wss://purplepag.es', 'wss://nostr.mom', 'wss://nos.lol', 'wss://offchain.pub']

const defaultPubkey = "726a1e261cc6474674e8285e3951b3bb139be9a773d1acf49dc868db861a1c11";
const altPubkey = "afd563434a737334d69db899e4a32fe38d73a182bb6d1e91d83a2c4c4e04737c";

render(() => {
  
  const [pubkey, setPubkey] = createSignal(defaultPubkey);

  return <>
    <h1>Super Blog</h1>
    <h2>Sample article</h2>
    <button onClick={() => pubkey() ? setPubkey('') : setPubkey(defaultPubkey)}>{pubkey() ? 'Log out' : 'Log in'}</button>
    <p>
      {pubkey() && <span>Logged in as {pubkey()}</span>}
    </p>
    <p>{jackArticle}</p>

    <p>
    Lorem ipsum dolor sit amet, consectetur adipisicing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum. Lorem ipsum dolor sit amet, consectetur adipisicing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.
    </p>
    
    {/* solid component */}
    {/* <ZapThreads anchor={tonyArticle} relays={['wss://relay.damus.io']} disableZaps={false} disableLikes={true} disablePublish={true} pubkey={pubkey()} /> */}
    {/* web component */}
    <zap-threads anchor={jackArticle} relays={moreRelays.join(',')} disable-publish="true" pubkey={pubkey()} />
  </>
}, root);
