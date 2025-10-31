// Custom ambient module declarations to silence missing @types for some third-party libs
declare module 'xss-clean' {
	import { RequestHandler } from 'express';
	function xss(): RequestHandler;
	export default xss;
}

declare module 'pg';
declare module '@paypal/checkout-server-sdk';
declare module 'flutterwave-node-v3';
declare module 'express-rate-limit';
declare module 'express-slow-down';
declare module 'winston-daily-rotate-file';
declare module 'express-mongo-sanitize';
declare module 'express-useragent';
declare module 'hpp';
declare module 'csurf';
declare module 'connect-redis';

export {};
