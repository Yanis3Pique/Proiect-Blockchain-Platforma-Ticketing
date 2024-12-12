const { ethers, network } = require("hardhat");

async function main() {
  // Obtine contul
  const [deployer] = await ethers.getSigners();
  console.log("Deploying contracts with the account:", deployer.address);

  // Afiseaza soldul contului
  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("Account balance:", balance, "ETH");

  // Adresa Chainlink Price Feed pentru ETH/USD pe Sepolia
  let priceFeedAddress;
  if (network.name === "sepolia") {
    priceFeedAddress = "0x694AA1769357215DE4FAC081bf1f309aDC325306"; // ETH/USD Chainlink Price Feed pe Sepolia
  } else {
    throw new Error("Unsupported network");
  }

  // Deploy la contractul TicketingPlatform
  const TicketingPlatform = await ethers.getContractFactory("TicketingPlatform");
  console.log("Deploying TicketingPlatform...");
  const ticketingPlatform = await TicketingPlatform.deploy(priceFeedAddress);

  const txReceipt = await ticketingPlatform.deploymentTransaction().wait();
  console.log("TicketingPlatform deployed to:", ticketingPlatform.target);

  console.log("Transaction hash:", txReceipt.transactionHash);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Error deploying contracts:", error);
    process.exit(1);
  });
