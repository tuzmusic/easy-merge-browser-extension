import { render, type VNode } from 'preact';
import type { MergeRow, RowStatus } from '../lib/merge';
import { Dialog, dialogCss, type DialogProps } from './Dialog';
import { MergeDialog, mergeDialogCss, type MergeDialogProps } from './MergeDialog';

/** Render into a shadow root (so Gmail's CSS can't touch it). Returns a function that removes it. */
function mountInShadow(css: string, vnode: VNode): () => void {
  const host = document.createElement('div');
  const shadow = host.attachShadow({ mode: 'open' });
  const style = document.createElement('style');
  style.textContent = css;
  const mountPoint = document.createElement('div');
  shadow.append(style, mountPoint);
  document.body.append(host);
  render(vnode, mountPoint);
  return () => {
    render(null, mountPoint);
    host.remove();
  };
}

export function showDialog(props: Omit<DialogProps, 'onSend' | 'onSendAnyway' | 'onCancel'>) {
  return new Promise<
    { action: 'send'; values: Record<string, string> } | { action: 'sendAnyway' } | { action: 'cancel' }
  >((resolve) => {
    const done = (result: Parameters<typeof resolve>[0]) => {
      unmount();
      resolve(result);
    };
    const unmount = mountInShadow(
      dialogCss,
      <Dialog
        {...props}
        onSend={(values) => done({ action: 'send', values })}
        onSendAnyway={() => done({ action: 'sendAnyway' })}
        onCancel={() => done({ action: 'cancel' })}
      />,
    );
  });
}

export function showMergeDialog(props: Omit<MergeDialogProps, 'onDone' | 'onSendAnyway' | 'onCancel'>) {
  return new Promise<
    { action: 'merged'; rows: MergeRow[]; statuses: RowStatus[] } | { action: 'sendAnyway' } | { action: 'cancel' }
  >((resolve) => {
    const done = (result: Parameters<typeof resolve>[0]) => {
      unmount();
      resolve(result);
    };
    const unmount = mountInShadow(
      dialogCss + mergeDialogCss,
      <MergeDialog
        {...props}
        onDone={(rows, statuses) => done({ action: 'merged', rows, statuses })}
        onSendAnyway={() => done({ action: 'sendAnyway' })}
        onCancel={() => done({ action: 'cancel' })}
      />,
    );
  });
}
