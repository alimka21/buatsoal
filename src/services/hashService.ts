import CryptoJS from 'crypto-js';

export const generateHash = (payload: any): string => {
  // 1. Remove API key, generate_image, and image_model_name if present
  const { apiKey, generate_image, image_model_name, ...data } = payload;
  
  // Add model names to ensure hash changes if models change
  data.text_model_name = "gemini-2.5-flash";

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
