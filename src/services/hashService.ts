import CryptoJS from 'crypto-js';

export const generateHash = (payload: any): string => {
  // 1. Remove API key if present
  const { apiKey, ...data } = payload;
  
  // 2. Deterministic sort of keys
  const sortObject = (obj: any): any => {
    if (typeof obj !== 'object' || obj === null) {
      return obj;
    }
    if (Array.isArray(obj)) {
      return obj.map(sortObject);
    }
    return Object.keys(obj)
      .sort()
      .reduce((result: any, key) => {
        result[key] = sortObject(obj[key]);
        return result;
      }, {});
  };

  const sortedData = sortObject(data);

  // 3. Hash
  return CryptoJS.SHA256(JSON.stringify(sortedData)).toString();
};
