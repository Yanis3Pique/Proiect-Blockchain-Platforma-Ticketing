const { ethers, network } = require("hardhat");

async function main() {
  // Obține contul de deplasare
  const [deployer] = await ethers.getSigners();
  console.log("Deploying contracts with the account:", deployer.address);

  // Afișează soldul contului
  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("Account balance:", balance, "ETH");

  // Adresa Chainlink Price Feed pentru ETH/USD pe Sepolia
  let priceFeedAddress;
  if (network.name === "sepolia") {
    priceFeedAddress = "0x694AA1769357215DE4FAC081bf1f309aDC325306"; // ETH/USD Chainlink Price Feed pe Sepolia
  } else {
    throw new Error("Unsupported network");
  }

  // Deploiază contractul TicketingPlatform
  const TicketingPlatform = await ethers.getContractFactory("TicketingPlatform");
  console.log("Deploying TicketingPlatform...");
  const ticketingPlatform = await TicketingPlatform.deploy(priceFeedAddress);

  // Așteaptă confirmarea tranzacției de deplasare
  const txReceipt = await ticketingPlatform.deploymentTransaction().wait();
  console.log("TicketingPlatform deployed to:", ticketingPlatform.target);

  // Afișează hash-ul tranzacției
  console.log("Transaction hash:", txReceipt.transactionHash);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Error deploying contracts:", error);
    process.exit(1);
  });
