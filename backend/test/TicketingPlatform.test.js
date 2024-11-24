const { expect } = require("chai");
const { ethers, network } = require("hardhat");

describe("TicketingPlatform and EventContract", function () {
  let TicketingPlatformFactory, EventContractFactory;
  let ticketingPlatform, eventContract;
  let owner, organizer, buyer1, buyer2, others;
  let priceFeedAddress;

  before(async function () {
    [owner, organizer, buyer1, buyer2, ...others] = await ethers.getSigners();

    // Chainlink ETH/USD Price Feed address on Sepolia
    priceFeedAddress = "0x694AA1769357215DE4FAC081bf1f309aDC325306";

    // Get the contract factories
    TicketingPlatformFactory = await ethers.getContractFactory("TicketingPlatform");
    EventContractFactory = await ethers.getContractFactory("EventContract");
  });

  beforeEach(async function () {
    // Deploy the TicketingPlatform contract
    ticketingPlatform = await TicketingPlatformFactory.deploy(priceFeedAddress);
    await ticketingPlatform.deployed();
  });

  describe("Event Creation", function () {
    it("Should create an event successfully", async function () {
      const eventName = "Concert Event";
      const eventLocation = "New York City";
      const eventDate = (await ethers.provider.getBlock("latest")).timestamp + 86400; // +1 day
      const ticketPriceUSD = 50; // $50
      const ticketsAvailable = 100;

      const tx = await ticketingPlatform
        .connect(organizer)
        .createEvent(
          eventName,
          eventLocation,
          eventDate,
          ticketPriceUSD,
          ticketsAvailable
        );

      // Wait for the transaction to be mined
      const receipt = await tx.wait();

      // Extract the EventCreated event from the receipt
      const event = receipt.events.find((e) => e.event === "EventCreated");
      const eventAddress = event.args.eventAddress;

      expect(eventAddress).to.properAddress;

      // Get the deployed EventContract instance
      eventContract = await EventContractFactory.attach(eventAddress);
    });

    it("Should fail to create an event with past date", async function () {
      const pastDate = (await ethers.provider.getBlock("latest")).timestamp - 86400; // -1 day

      await expect(
        ticketingPlatform
          .connect(organizer)
          .createEvent(
            "Past Event",
            "Location",
            pastDate,
            50,
            100
          )
      ).to.be.revertedWith("Event date must be in the future.");
    });
  });

  describe("Ticket Purchasing", function () {
    beforeEach(async function () {
      // Create an event
      const eventName = "Concert Event";
      const eventLocation = "New York City";
      const eventDate = (await ethers.provider.getBlock("latest")).timestamp + 86400; // +1 day
      const ticketPriceUSD = 50; // $50
      const ticketsAvailable = 100;

      const tx = await ticketingPlatform
        .connect(organizer)
        .createEvent(
          eventName,
          eventLocation,
          eventDate,
          ticketPriceUSD,
          ticketsAvailable
        );

      await tx.wait();

      const eventAddress = await ticketingPlatform.events(0);
      const EventContractFactory = await ethers.getContractFactory("EventContract");
      eventContract = await EventContractFactory.attach(eventAddress);
    });

    it("Should purchase tickets successfully", async function () {
      const ticketPriceInWei = await eventContract.getTicketPriceInWei();
      const quantity = 2;
      const totalPriceWithoutFee = ticketPriceInWei.mul(quantity);

      const serviceFee = totalPriceWithoutFee.mul(2).div(100);
      const totalPriceWithFee = totalPriceWithoutFee.add(serviceFee);

      await expect(
        eventContract
          .connect(buyer1)
          .buyTickets(quantity, { value: totalPriceWithFee })
      )
        .to.emit(eventContract, "TicketPurchased")
        .withArgs(1, buyer1.address);

      expect(await eventContract.balanceOf(buyer1.address)).to.equal(quantity);
    });

    it("Should fail to purchase tickets with insufficient funds", async function () {
      const ticketPriceInWei = await eventContract.getTicketPriceInWei();
      const quantity = 1;
      const totalPriceWithoutFee = ticketPriceInWei.mul(quantity);

      const insufficientAmount = totalPriceWithoutFee; // Not including service fee

      await expect(
        eventContract
          .connect(buyer1)
          .buyTickets(quantity, { value: insufficientAmount })
      ).to.be.revertedWith("Insufficient funds to purchase tickets.");
    });
  });

  describe("Ticket Transfer", function () {
    beforeEach(async function () {
      // Create an event and purchase tickets
      const eventName = "Concert Event";
      const eventLocation = "New York City";
      const eventDate = (await ethers.provider.getBlock("latest")).timestamp + 86400; // +1 day
      const ticketPriceUSD = 50; // $50
      const ticketsAvailable = 100;

      const tx = await ticketingPlatform
        .connect(organizer)
        .createEvent(
          eventName,
          eventLocation,
          eventDate,
          ticketPriceUSD,
          ticketsAvailable
        );

      await tx.wait();

      const eventAddress = await ticketingPlatform.events(0);
      const EventContractFactory = await ethers.getContractFactory("EventContract");
      eventContract = await EventContractFactory.attach(eventAddress);

      const ticketPriceInWei = await eventContract.getTicketPriceInWei();
      const quantity = 1;
      const totalPriceWithoutFee = ticketPriceInWei.mul(quantity);
      const serviceFee = totalPriceWithoutFee.mul(2).div(100);
      const totalPriceWithFee = totalPriceWithoutFee.add(serviceFee);

      await eventContract
        .connect(buyer1)
        .buyTickets(quantity, { value: totalPriceWithFee });
    });

    it("Should transfer ticket successfully", async function () {
      await expect(
        eventContract
          .connect(buyer1)
          .transferTicket(1, buyer2.address)
      )
        .to.emit(eventContract, "TicketTransferred")
        .withArgs(1, buyer1.address, buyer2.address);

      expect(await eventContract.ownerOf(1)).to.equal(buyer2.address);
    });

    it("Should fail to transfer ticket after event date", async function () {
      // Fast forward time beyond event date
      await network.provider.send("evm_increaseTime", [86400 * 2]);
      await network.provider.send("evm_mine");

      await expect(
        eventContract
          .connect(buyer1)
          .transferTicket(1, buyer2.address)
      ).to.be.revertedWith("Cannot transfer tickets after the event date.");
    });
  });

  describe("Event Cancellation and Refunds", function () {
    beforeEach(async function () {
      // Create an event and purchase tickets
      const eventName = "Concert Event";
      const eventLocation = "New York City";
      const eventDate = (await ethers.provider.getBlock("latest")).timestamp + 86400; // +1 day
      const ticketPriceUSD = 50; // $50
      const ticketsAvailable = 100;

      const tx = await ticketingPlatform
        .connect(organizer)
        .createEvent(
          eventName,
          eventLocation,
          eventDate,
          ticketPriceUSD,
          ticketsAvailable
        );

      await tx.wait();

      const eventAddress = await ticketingPlatform.events(0);
      const EventContractFactory = await ethers.getContractFactory("EventContract");
      eventContract = await EventContractFactory.attach(eventAddress);

      const ticketPriceInWei = await eventContract.getTicketPriceInWei();
      const quantity = 1;
      const totalPriceWithoutFee = ticketPriceInWei.mul(quantity);
      const serviceFee = totalPriceWithoutFee.mul(2).div(100);
      const totalPriceWithFee = totalPriceWithoutFee.add(serviceFee);

      await eventContract
        .connect(buyer1)
        .buyTickets(quantity, { value: totalPriceWithFee });
    });

    it("Should allow organizer to cancel event", async function () {
      await expect(
        eventContract.connect(organizer).cancelEvent()
      )
        .to.emit(eventContract, "EventCancelled");

      expect(await eventContract.isCancelled()).to.be.true;
    });

    it("Should allow ticket holders to refund after cancellation", async function () {
      await eventContract.connect(organizer).cancelEvent();

      const buyerBalanceBefore = await ethers.provider.getBalance(buyer1.address);

      await expect(
        eventContract.connect(buyer1).refundTicket(1)
      )
        .to.emit(eventContract, "TicketRefunded")
        .withArgs(1, buyer1.address, anyValue);

      const buyerBalanceAfter = await ethers.provider.getBalance(buyer1.address);
      expect(buyerBalanceAfter).to.be.gt(buyerBalanceBefore);
    });
  });

  // Additional tests for access control, edge cases, etc.
});
