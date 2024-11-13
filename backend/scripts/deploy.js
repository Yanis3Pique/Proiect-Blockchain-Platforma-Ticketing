const hre = require("hardhat");

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  console.log("Deploying contracts with the account:", deployer.address);

  // Deploy EventManager
  const EventManager = await hre.ethers.getContractFactory("EventManager");
  const eventManager = await EventManager.deploy();
  await eventManager.deployed();
  console.log("EventManager deployed to:", eventManager.address);

  // Deploy TicketNFT with the EventManager address and a Chainlink oracle address for testing (e.g., ETH/USD on Rinkeby or Goerli)
  const TicketNFT = await hre.ethers.getContractFactory("TicketNFT");
  const priceFeedAddress = "0x694AA1769357215DE4FAC081bf1f309aDC325306"; // Replace with a valid oracle address
  const uri = "https://your-metadata-url.com"; // Replace with a valid metadata URI
  const ticketNFT = await TicketNFT.deploy(eventManager.address, uri, priceFeedAddress);
  await ticketNFT.deployed();
  console.log("TicketNFT deployed to:", ticketNFT.address);
}


main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
