declare module 'flutterwave-node-v3' {
  class Flutterwave {
    constructor(publicKey?: string, secretKey?: string);
    Charge: { card(payload: any): Promise<any> };
    Transaction: { verify(opts: any): Promise<any>; refund(opts: any): Promise<any> };
  }
  export default Flutterwave;
}

export {};
