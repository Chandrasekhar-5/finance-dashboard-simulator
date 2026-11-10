import crypto from 'crypto';

export const generateAccountNumber = (): string => {
    const randomBigInt = BigInt('0x' + crypto.randomBytes(5).toString('hex'));
    const num = 1000000000n + (randomBigInt % 9000000000n);
    return num.toString();
};