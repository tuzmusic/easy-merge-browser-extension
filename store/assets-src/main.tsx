// Staged scenes for the Chrome Web Store screenshots and promo tile. The dialog is the real component
// with the real autofill; the compose window around it is modeled on real Gmail captures (plain text,
// no wildcard highlighting, since EasyMerge doesn't add any).
// Pick a scene with ?scene=<name>; render.mjs captures each at its exact store size.
import { render } from 'preact';
import { Dialog, dialogCss } from '../../src/ui/Dialog';
import { autofill, type Recipient } from '../../src/lib/autofill';
import iconUrl from '../../public/icons/icon.svg';
import composeIconUrl from '../../public/icons/icon-32.png';

const priya: Recipient = { name: 'Priya Raman', emailAddress: 'priya.raman@northwind.io' };
const marcus: Recipient = { name: 'Marcus Chen', emailAddress: 'marcus.chen@contoso.com' };

const SUBJECT = '_ROLE at _COMPANY';
const BODY = [
  'Hi _FIRST_NAME,',
  '',
  "I came across _COMPANY's opening for a _ROLE and wanted to reach out directly. I've spent the last six years building front-end tools for teams like yours. Some recent work: _PORTFOLIO",
  '',
  'Would you have 20 minutes next week to talk?',
  '',
  'Thanks,',
  'Sam',
];
// In order of appearance, subject first, as the extension lists them.
const WILDCARDS = ['_ROLE', '_COMPANY', '_FIRST_NAME', '_PORTFOLIO'];

const fill = (text: string, values: Record<string, string>) =>
  text.replace(/_[A-Z][A-Z_]*[A-Z]/g, (w) => values[w] ?? w);

const noop = () => {};

// Material icon paths (Apache 2.0) for the compose toolbar.
const ICONS = {
  attach: 'M16.5 6v11.5c0 2.21-1.79 4-4 4s-4-1.79-4-4V5a2.5 2.5 0 0 1 5 0v10.5c0 .55-.45 1-1 1s-1-.45-1-1V6H10v9.5a2.5 2.5 0 0 0 5 0V5c0-2.21-1.79-4-4-4S7 2.79 7 5v12.5c0 3.04 2.46 5.5 5.5 5.5s5.5-2.46 5.5-5.5V6h-1.5z',
  link: 'M3.9 12c0-1.71 1.39-3.1 3.1-3.1h4V7H7c-2.76 0-5 2.24-5 5s2.24 5 5 5h4v-1.9H7c-1.71 0-3.1-1.39-3.1-3.1zM8 13h8v-2H8v2zm9-6h-4v1.9h4c1.71 0 3.1 1.39 3.1 3.1s-1.39 3.1-3.1 3.1h-4V17h4c2.76 0 5-2.24 5-5s-2.24-5-5-5z',
  photo: 'M19 5v14H5V5h14m0-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-4.86 8.86-3 3.87L9 13.14 6 17h12l-3.86-5.14z',
  trash: 'M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM8 9h8v10H8V9zm7.5-5-1-1h-5l-1 1H5v2h14V4h-3.5z',
};
const Icon = ({ d }: { d: string }) => (
  <svg class="tool" viewBox="0 0 24 24"><path d={d} /></svg>
);

function Compose({ to }: { to: Recipient }) {
  return (
    <div class="compose">
      <div class="compose-bar">
        <span>{SUBJECT}</span>
        <span class="bar-icons">–&nbsp;&nbsp;⤡&nbsp;&nbsp;✕</span>
      </div>
      <div class="row">
        <span class="label">To</span>
        <span class="chip"><span class="avatar" />{to.emailAddress}<span class="x">✕</span></span>
        <span class="ccbcc">Cc Bcc</span>
      </div>
      <div class="row">{SUBJECT}</div>
      <div class="body">
        {BODY.map((line) => <p>{line || ' '}</p>)}
      </div>
      <div class="toolbar">
        <span class="send"><span>Send</span><span class="caret">▾</span></span>
        <img class="em" src={composeIconUrl} alt="" />
        <span class="aa">Aa</span>
        <Icon d={ICONS.attach} />
        <Icon d={ICONS.link} />
        <Icon d={ICONS.photo} />
        <span class="spacer" />
        <Icon d={ICONS.trash} />
      </div>
    </div>
  );
}

/** Mount the real dialog in a shadow root, as the extension does, inside the stage. */
function DialogLayer({ to, lastValues }: { to: Recipient; lastValues: Record<string, string> }) {
  return (
    <div
      class="dialog-layer"
      ref={(host) => {
        if (!host || host.shadowRoot) return;
        const shadow = host.attachShadow({ mode: 'open' });
        const style = document.createElement('style');
        style.textContent = dialogCss;
        const mount = document.createElement('div');
        shadow.append(style, mount);
        render(
          <Dialog
            wildcards={WILDCARDS}
            autofilled={autofill(WILDCARDS, [to])}
            lastValues={lastValues}
            onSend={noop}
            onSendAnyway={noop}
            onCancel={noop}
          />,
          mount,
        );
      }}
    />
  );
}

/** A sent message, as the recipient would read it. */
function Sent({ to, values }: { to: Recipient; values: Record<string, string> }) {
  return (
    <div class="sent">
      <div class="sent-subject">{fill(SUBJECT, values)}</div>
      <div class="sent-to">to {to.emailAddress}</div>
      <div class="sent-body">
        {BODY.map((line) => <p>{line ? fill(line, values) : ' '}</p>)}
      </div>
    </div>
  );
}

function Shot({ title, sub, children }: { title: string; sub: string; children: preact.ComponentChildren }) {
  return (
    <div class="shot">
      <header>
        <h1>{title}</h1>
        <p>{sub}</p>
      </header>
      <div class="stage">{children}</div>
    </div>
  );
}

const priyaValues = {
  _FIRST_NAME: 'Priya', _COMPANY: 'Northwind', _ROLE: 'Senior Front-End Engineer', _PORTFOLIO: 'samlee.dev/work',
};

const scenes: Record<string, () => preact.JSX.Element> = {
  template: () => (
    <Shot
      title="Your draft is the template"
      sub="Type wildcards like _FIRST_NAME in a normal Gmail draft. When you send it, they're filled in for that person."
    >
      <div class="window narrow"><Compose to={priya} /></div>
      <div class="arrow">→</div>
      <div class="sent-stack">
        <Sent to={priya} values={priyaValues} />
      </div>
    </Shot>
  ),
  fill: () => (
    <Shot
      title="Hit Send, then fill in the wildcards"
      sub="Name and company are filled in from the recipient's email. You type the rest."
    >
      <div class="window">
        <Compose to={priya} />
        <DialogLayer to={priya} lastValues={{}} />
      </div>
    </Shot>
  ),
  reuse: () => (
    <Shot
      title="Reuse the values you entered last time"
      sub="Each field shows what you used last time. Press Tab to use it again, or fill them all at once."
    >
      <div class="window">
        <Compose to={marcus} />
        <DialogLayer to={marcus} lastValues={priyaValues} />
      </div>
    </Shot>
  ),
  // Store-spec 128px icon: 96px of artwork inside 16px of transparent padding.
  'icon-padded': () => <img class="icon padded" src={iconUrl} alt="" />,
  icon: () => <img class="icon" src={iconUrl} alt="" />,
  // A: the original, minus the slogan.
  promo: () => (
    <div class="promo">
      <img src={iconUrl} alt="" />
      <div class="wordmark">
        <span class="accent">_</span>Easy<span class="accent">Merge</span>
      </div>
    </div>
  ),
  // B: the name swiped with a highlighter on paper.
  'promo-highlighter': () => (
    <div class="promo-highlighter">
      <span>EasyMerge</span>
    </div>
  ),
  // C: poster type, too big for the tile.
  'promo-poster': () => (
    <div class="promo-poster">
      <div><i />EASY</div>
      <div>MERGE</div>
    </div>
  ),
  // D: rows of wildcards, one of them filled in.
  'promo-rows': () => (
    <div class="promo-rows">
      {[0, 1, 2, 3, 4, 5, 6].map((i) =>
        i === 3 ? (
          <div class="filled">EasyMerge<b /></div>
        ) : (
          <div style={{ opacity: 0.5 - Math.abs(i - 3) * 0.12 }}>_EASY_MERGE</div>
        ),
      )}
    </div>
  ),
  // E: a paper form with the first half of the name written on the line.
  'promo-form': () => (
    <div class="promo-form">
      <div class="line">
        <span class="blank"><span class="ink">Easy</span></span>
        <span class="printed">Merge</span>
      </div>
    </div>
  ),
};

const scene = new URLSearchParams(location.search).get('scene') ?? 'fill';
document.documentElement.dataset.scene = scene;
render(scenes[scene](), document.getElementById('root')!);

const css = document.createElement('style');
css.textContent = `
  html, body { margin: 0; background: #f8fafd; font-family: system-ui, sans-serif; color: #202124; -webkit-font-smoothing: antialiased; }
  html[data-scene="fill"], html[data-scene="template"], html[data-scene="reuse"] { width: 1280px; height: 800px; }
  html[data-scene^="promo"] { width: 440px; height: 280px; }
  html[data-scene^="icon"], html[data-scene^="icon"] body { background: transparent; }
  .icon { display: block; width: 100vw; height: 100vh; box-sizing: border-box; }
  .icon.padded { padding: 12.5vw; }

  .shot { width: 1280px; height: 800px; box-sizing: border-box; padding: 48px 64px 44px;
    background: linear-gradient(160deg, #e8f0fe 0%, #f8fafd 60%); display: flex; flex-direction: column;
    gap: 32px; overflow: hidden; }
  .shot header { text-align: center; }
  .shot h1 { margin: 0 0 10px; font-size: 40px; font-weight: 700; letter-spacing: -.02em; }
  .shot header p { margin: 0 auto; font-size: 20px; color: #5f6368; max-width: 980px; line-height: 1.35; }

  .stage { flex: 1; display: flex; justify-content: center; align-items: stretch; gap: 28px; min-height: 0; }
  /* transform makes the window the containing block for the dialog's position:fixed backdrop,
     so the dim covers the compose window rather than the whole slide. */
  .window { position: relative; width: 940px; transform: translateZ(0); border-radius: 12px;
    overflow: hidden; box-shadow: 0 12px 40px rgba(60,64,67,.18), 0 2px 6px rgba(60,64,67,.12); display: flex; }
  .window.narrow { width: 620px; flex: none; }

  /* Modeled on Gmail's maximized compose window. */
  .compose { flex: 1; background: #fff; display: flex; flex-direction: column; color: #1f1f1f; }
  .compose-bar { background: #f2f6fc; padding: 11px 16px; font-size: 14px; font-weight: 500;
    display: flex; justify-content: space-between; }
  .bar-icons { color: #444746; font-weight: 400; }
  .row { margin: 0 16px; padding: 9px 0; border-bottom: 1px solid #e3e3e3; font-size: 14px;
    display: flex; align-items: center; gap: 8px; min-height: 22px; }
  .label { color: #444746; }
  .chip { display: inline-flex; align-items: center; gap: 6px; border: 1px solid #747775; border-radius: 999px;
    padding: 2px 8px 2px 2px; font-weight: 500; font-size: 14px; }
  .avatar { width: 20px; height: 20px; border-radius: 50%; background: #c2d5f5 radial-gradient(circle at 50% 38%, #0b57d0 0 3.5px, transparent 4px); }
  .chip .x { color: #444746; font-size: 11px; margin-left: 4px; }
  .ccbcc { margin-left: auto; color: #444746; }
  .body { padding: 12px 16px; font: 13.5px/1.45 Arial, Helvetica, sans-serif; flex: 1; color: #222; }
  .body p { margin: 0; }
  .toolbar { display: flex; align-items: center; gap: 14px; padding: 10px 16px 14px; }
  .send { display: inline-flex; align-items: center; background: #0b57d0; color: #fff; border-radius: 999px;
    font-size: 14px; font-weight: 500; overflow: hidden; }
  .send span:first-child { padding: 9px 18px 9px 20px; }
  .caret { padding: 9px 12px; border-left: 1px solid rgba(255,255,255,.35); font-size: 11px; }
  .em { width: 18px; height: 18px; border-radius: 4px; }
  .aa { color: #444746; font-size: 16px; }
  .tool { width: 20px; height: 20px; fill: #444746; }
  .spacer { flex: 1; }

  .arrow { align-self: center; font-size: 40px; color: #8ab4f8; }
  .sent-stack { width: 470px; display: flex; flex-direction: column; justify-content: center; gap: 20px; }
  .sent { background: #fff; border-radius: 12px; padding: 18px 20px; box-shadow: 0 6px 20px rgba(60,64,67,.14); }
  .sent-subject { font-size: 18px; font-weight: 500; margin-bottom: 4px; }
  .sent-to { font-size: 13px; color: #5f6368; margin-bottom: 12px; }
  .sent-body { font: 13.5px/1.45 Arial, Helvetica, sans-serif; color: #222; }
  .sent-body p { margin: 0; }

  .dialog-layer { position: absolute; inset: 0; }

  .promo, [class^="promo-"] { width: 440px; height: 280px; box-sizing: border-box; overflow: hidden;
    position: relative; display: flex; align-items: center; justify-content: center; }

  .promo { background: linear-gradient(150deg, #1a73e8, #0b57d0); color: #fff; gap: 22px; }
  .promo img { width: 88px; height: 88px; border-radius: 20px; box-shadow: 0 6px 18px rgba(0,0,0,.25);
    outline: 2px solid rgba(255,255,255,.35); }
  .wordmark { font-size: 44px; font-weight: 700; letter-spacing: -.02em; }
  .wordmark .accent { color: #aecbfa; }

  .promo-highlighter { background: #f6f1e7; }
  .promo-highlighter span { font: italic 92px 'Instrument Serif', serif; color: #1b1b1b; letter-spacing: -.02em;
    position: relative; transform: rotate(-3deg); }
  .promo-highlighter span::before { content: ''; position: absolute; left: -14px; right: -18px; top: 52%; height: 42%;
    background: #ffe14d; border-radius: 4px 14px 6px 18px; transform: skewX(-12deg) rotate(1deg); z-index: -1; }

  .promo-poster { background: #0d0d0d; color: #f4f4f0; flex-direction: column; align-items: flex-start;
    justify-content: flex-end; padding: 0 0 14px 20px; font: 106px/0.82 'Archivo Black', sans-serif;
    letter-spacing: -.04em; }
  .promo-poster div { white-space: nowrap; display: flex; align-items: flex-end; }
  .promo-poster i { display: inline-block; width: 52px; height: 14px; background: #c8ff2e; margin: 0 10px 4px 0; }
  .promo-poster div:last-child { margin-left: -6px; }

  .promo-rows { background: #101418; flex-direction: column; gap: 6px;
    font: 400 24px 'JetBrains Mono', monospace; color: #8ab4f8; letter-spacing: .02em; }
  .promo-rows .filled { font-weight: 800; font-size: 40px; color: #fff; display: flex; align-items: center;
    margin: 6px 0; }
  .promo-rows .filled b { display: inline-block; width: 4px; height: 38px; background: #8ab4f8; margin-left: 6px; }

  .promo-form { background: #fbfaf6;
    background-image: repeating-linear-gradient(transparent 0 27px, #e4ebf5 27px 28px); }
  .promo-form::before { content: ''; position: absolute; left: 44px; top: 0; bottom: 0; width: 1px; background: #f0b4b4; }
  .promo-form .line { display: flex; align-items: flex-end; gap: 10px; margin-top: 20px; }
  .promo-form .blank { display: inline-block; width: 190px; border-bottom: 2px solid #1b1b1b; text-align: center;
    padding-bottom: 0; }
  .promo-form .ink { font: 600 84px/1 'Caveat', cursive; color: #1f3fbf; display: inline-block;
    transform: rotate(-4deg) translateY(10px); }
  .promo-form .printed { font: 76px/1 'Instrument Serif', serif; color: #1b1b1b; margin-bottom: -10px; }
`;
document.head.append(css);
