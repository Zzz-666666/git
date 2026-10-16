import {pbkdf2Async} from '@noble/hashes/pbkdf2.js';
import {sha256} from '@noble/hashes/sha2.js';
import {bytesToHex} from '@noble/hashes/utils.js';

// Hosted Workers cap native PBKDF2 at 100,000. Keep the existing 600,000-round
// SHA-256 format using the portable implementation, so existing passwords work.
export async function passwordHash(password:string,salt:string){
 const utf8=new TextEncoder();
 return bytesToHex(await pbkdf2Async(sha256,utf8.encode(password),utf8.encode(salt),{c:600000,dkLen:32,asyncTick:8}));
}
