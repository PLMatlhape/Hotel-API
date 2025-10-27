declare module 'xss-clean' {
  import { RequestHandler } from 'express';
  function xss(): RequestHandler;
  export default xss;
}

declare module '@paypal/checkout-server-sdk' {
  const paypal: any;
  export default paypal;
}

declare module 'flutterwave-node-v3' {
  const flutterwave: any;
  export default flutterwave;
}

export {};
