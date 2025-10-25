declare module '@paypal/checkout-server-sdk' {
  export namespace core {
    class LiveEnvironment { constructor(clientId: string, clientSecret: string); }
    class SandboxEnvironment { constructor(clientId: string, clientSecret: string); }
    class PayPalHttpClient { constructor(environment: any); execute(request: any): Promise<any>; }
  }
  export namespace orders {
    class OrdersCreateRequest { prefer(_s: string): void; requestBody(_b: any): void; }
    class OrdersGetRequest { constructor(id: string); }
  }
  export namespace payments {
    class CapturesRefundRequest { constructor(captureId: string); requestBody?(body: any): void; }
  }
  const paypal: { core: any; orders: any; payments: any };
  export default paypal;
}

export {};
