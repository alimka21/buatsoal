const str = "{\n  \"question\": \"$\\\\\\angle\"\n}";
console.log(str);
try { JSON.parse(str); console.log("success"); } catch(e) { console.log(e.message); }
