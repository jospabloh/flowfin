export const FLOWFIN_TUTORIAL_START_EVENT = 'flowfin:tutorial:start';

export function launchFlowfinTutorial(detail = {}) {
  globalThis.dispatchEvent(
    new CustomEvent(FLOWFIN_TUTORIAL_START_EVENT, {
      detail,
    })
  );
}