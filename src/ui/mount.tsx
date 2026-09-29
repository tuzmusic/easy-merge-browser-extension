import { render } from 'preact';
import { Dialog, dialogCss, type DialogProps } from './Dialog';

/** Show the dialog in a shadow root (so Gmail's CSS can't touch it). Returns a close function. */
export function showDialog(props: Omit<DialogProps, 'onSend' | 'onSendAnyway' | 'onCancel'>) {
  return new Promise<
    { action: 'send'; values: Record<string, string> } | { action: 'sendAnyway' } | { action: 'cancel' }
  >((resolve) => {
    const host = document.createElement('div');
    const shadow = host.attachShadow({ mode: 'open' });
    const style = document.createElement('style');
    style.textContent = dialogCss;
    const mountPoint = document.createElement('div');
    shadow.append(style, mountPoint);
    document.body.append(host);

    const done = (result: Parameters<typeof resolve>[0]) => {
      render(null, mountPoint);
      host.remove();
      resolve(result);
    };

    render(
      <Dialog
        {...props}
        onSend={(values) => done({ action: 'send', values })}
        onSendAnyway={() => done({ action: 'sendAnyway' })}
        onCancel={() => done({ action: 'cancel' })}
      />,
      mountPoint,
    );
  });
}
