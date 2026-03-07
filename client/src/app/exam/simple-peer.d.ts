declare module 'simple-peer' {
  // This pattern allows for both a default export (the constructor)
  // and a namespace for types like `Instance`.
  function Peer(opts?: any): Peer.Instance;
  namespace Peer {
    // Using 'any' is the simplest fix for the reported error,
    // while still providing the correct structure.
    export type Instance = any;
    export const WEBRTC_SUPPORT: boolean;
  }
  export default Peer;
}