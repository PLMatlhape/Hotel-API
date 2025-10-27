// Custom ambient module declarations to silence missing @types for some third-party libs
declare module 'xss-clean' {
	function xss(): any;
	export default xss;
}
declare module 'pg';
declare module '@paypal/checkout-server-sdk';
declare module 'flutterwave-node-v3';
declare module 'express-rate-limit';
declare module 'express-slow-down';
declare module 'winston-daily-rotate-file';

// You can add more `declare module '...'` entries here for other packages

export {};
