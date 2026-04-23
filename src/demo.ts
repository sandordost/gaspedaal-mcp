import { searchGaspedaal } from "./gaspedaal";

async function main(): Promise<void> {
  const result = await searchGaspedaal({ make: "Cupra", model: "Formentor" });
  console.log(JSON.stringify(result, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
