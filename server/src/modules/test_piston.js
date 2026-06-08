import { executeCodeOnPiston } from './pistonExecutor.js';

async function run() {
  console.log("=== Testing JavaScript Wrapper ===");
  const jsCode = `
function sum(x, y, z) {
  return x + y + z;
}
  `;
  const testCases = [
    { input: "1 2 3", expected_output: "6" },
    { input: "10 20 30", expected_output: "60" },
    { input: "5 -5 0", expected_output: "0" }
  ];
  const functionName = "sum";

  const jsResult = await executeCodeOnPiston(jsCode, "javascript", testCases, functionName);
  console.log("JS Result:", JSON.stringify(jsResult, null, 2));

  console.log("\n=== Testing Python Wrapper ===");
  const pyCode = `
def sum(x, y, z):
    return x + y + z
  `;
  const pyResult = await executeCodeOnPiston(pyCode, "python", testCases, functionName);
  console.log("Python Result:", JSON.stringify(pyResult, null, 2));
}

run().catch(console.error);
