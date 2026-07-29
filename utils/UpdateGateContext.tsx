import { createContext, ReactNode, useContext } from 'react';

// Lets screens mounted under the root Stack (e.g. the tabs layout's live-
// stream check/popup) know a mandatory or optional update prompt is
// currently blocking the app, so they can skip checks/popups of their own
// instead of stacking on top of — or navigating out from under — the update
// screen. Defaults to false so anything rendered without a provider (tests,
// standalone usage) behaves as unblocked.
const UpdateGateContext = createContext(false);

export function useIsUpdateGateActive(): boolean {
  return useContext(UpdateGateContext);
}

export function UpdateGateProvider({ active, children }: { active: boolean; children: ReactNode }) {
  return <UpdateGateContext.Provider value={active}>{children}</UpdateGateContext.Provider>;
}
