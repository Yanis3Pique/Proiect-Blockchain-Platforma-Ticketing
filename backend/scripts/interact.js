async function main() {
  const [deployer, organizer, buyer1, buyer2, unauthorized] = await ethers.getSigners();

  // The address where the TicketingPlatform contract is deployed
  const contractAddress = "0x3f634aEa17725685E16616382a69AB89e87E88d5";

  // Attach to the deployed TicketingPlatform contract
  const TicketingPlatform = await ethers.getContractFactory("TicketingPlatform");
  const ticketingPlatform = TicketingPlatform.attach(contractAddress);

  console.log("Interacting with TicketingPlatform at address:", ticketingPlatform.target);

  // Display the next event ID
  let nextEventId = await ticketingPlatform.nextEventId();
  console.log("Next Event ID:", nextEventId.toString());

  // Create an event
  const eventName = "Concert";
  const eventLocation = "Stadium Bucharest";
  const eventDate = Math.floor(Date.now() / 1000) + 3600; // 1 hour in the future
  const ticketPriceUSD = 1; // Ticket price in USD
  const ticketsAvailable = 100; // Number of tickets

  console.log("Creating event:", eventName);

  const createEventTx = await ticketingPlatform.connect(organizer).createEvent(
    eventName,
    eventLocation,
    eventDate,
    ticketPriceUSD,
    ticketsAvailable
  );
  console.log("Creating event, transaction hash:", createEventTx.hash);

  // Wait for the transaction confirmation
  const createEventReceipt = await createEventTx.wait();
  console.log("Event created in block:", createEventReceipt.blockNumber);

  // Get the event address from the EventCreated event
  const eventCreatedEvent = createEventReceipt.events.find(event => event.event === "EventCreated");
  const eventAddress = eventCreatedEvent.args.eventAddress;
  console.log("Event address:", eventAddress);

  // Attach to the EventContract
  const EventContract = await ethers.getContractFactory("EventContract");
  const eventContract = EventContract.attach(eventAddress);
  console.log("Interacting with EventContract at address:", eventContract.address);

  // Get the latest ETH/USD price
  const latestPrice = await eventContract.getLatestPrice();
  console.log("Latest ETH/USD price:", latestPrice.toString());

  // Get the ticket price in Wei
  const ticketPriceInWei = await eventContract.getTicketPriceInWei();
  console.log("Ticket price in Wei:", ethers.utils.formatEther(ticketPriceInWei), "ETH");

  // Buyer1 purchases multiple tickets
  const quantity = 2;
  const totalPriceWithoutFee = ticketPriceInWei.mul(quantity);
  const serviceFee = totalPriceWithoutFee.mul(2).div(100); // 2% service fee
  const totalPriceWithFee = totalPriceWithoutFee.add(serviceFee);

  const buyTicketsTx = await eventContract.connect(buyer1).buyTickets(quantity, { value: totalPriceWithFee });
  console.log("Buyer1 buying tickets, transaction hash:", buyTicketsTx.hash);

  await buyTicketsTx.wait();
  console.log(`Buyer1 purchased ${quantity} tickets.`);

  // Buyer1 transfers a ticket to Buyer2
  const ticketIdToTransfer = 1;
  const transferTicketTx = await eventContract.connect(buyer1).transferTicket(ticketIdToTransfer, buyer2.address);
  console.log(`Transferring ticket ${ticketIdToTransfer} from Buyer1 to Buyer2, tx hash:`, transferTicketTx.hash);

  await transferTicketTx.wait();
  console.log(`Ticket ${ticketIdToTransfer} transferred to Buyer2.`);

  // Organizer invalidates a ticket
  const invalidateTicketTx = await eventContract.connect(organizer).invalidateTicket(2); // Invalidating ticket ID 2
  console.log(`Organizer invalidating ticket 2, tx hash:`, invalidateTicketTx.hash);

  await invalidateTicketTx.wait();
  console.log(`Ticket 2 invalidated.`);

  // Unauthorized user attempts to invalidate a ticket (should fail)
  try {
    const unauthorizedInvalidateTx = await eventContract.connect(unauthorized).invalidateTicket(1);
    await unauthorizedInvalidateTx.wait();
  } catch (error) {
    console.error("Unauthorized user failed to invalidate a ticket as expected:", error.message);
  }

  // Buyer1 attempts to transfer an invalidated ticket (should fail)
  try {
    const invalidTransferTx = await eventContract.connect(buyer1).transferTicket(2, buyer2.address);
    await invalidTransferTx.wait();
  } catch (error) {
    console.error("Failed to transfer invalidated ticket as expected:", error.message);
  }

  // Organizer cancels the event
  const cancelEventTx = await eventContract.connect(organizer).cancelEvent();
  console.log("Organizer canceling the event, tx hash:", cancelEventTx.hash);

  await cancelEventTx.wait();
  console.log("Event canceled.");

  // Buyer1 attempts to purchase tickets after cancellation (should fail)
  try {
    const buyAfterCancelTx = await eventContract.connect(buyer1).buyTickets(1, { value: totalPriceWithFee });
    await buyAfterCancelTx.wait();
  } catch (error) {
    console.error("Failed to purchase tickets after event cancellation as expected:", error.message);
  }

  // Buyer1 requests a refund
  const refundTicketTx = await eventContract.connect(buyer1).refundTicket(1);
  console.log(`Buyer1 requesting refund for ticket 1, tx hash:`, refundTicketTx.hash);

  await refundTicketTx.wait();
  console.log("Buyer1 refunded for ticket 1.");

  // Buyer2 attempts to refund a ticket they don't own (should fail)
  try {
    const refundInvalidTx = await eventContract.connect(buyer2).refundTicket(2);
    await refundInvalidTx.wait();
  } catch (error) {
    console.error("Buyer2 failed to refund a ticket they don't own as expected:", error.message);
  }

  // Organizer attempts to withdraw funds after cancellation (should fail)
  try {
    const withdrawFundsTx = await eventContract.connect(organizer).withdrawFunds();
    await withdrawFundsTx.wait();
  } catch (error) {
    console.error("Organizer failed to withdraw funds after cancellation as expected:", error.message);
  }

  // Simulate time passing beyond the event date
  await network.provider.send("evm_increaseTime", [3600 * 2]); // Increase time by 2 hours
  await network.provider.send("evm_mine"); // Mine a new block

  // Buyer1 attempts to transfer a ticket after the event date (should fail)
  try {
    const transferAfterEventTx = await eventContract.connect(buyer1).transferTicket(1, buyer2.address);
    await transferAfterEventTx.wait();
  } catch (error) {
    console.error("Failed to transfer ticket after event date as expected:", error.message);
  }

  // Organizer invalidates multiple tickets
  const ticketIdsToInvalidate = [3, 4, 5];
  const invalidateTicketsTx = await eventContract.connect(organizer).invalidateTickets(ticketIdsToInvalidate);
  console.log(`Organizer invalidating tickets ${ticketIdsToInvalidate.join(", ")}, tx hash:`, invalidateTicketsTx.hash);

  await invalidateTicketsTx.wait();
  console.log(`Tickets ${ticketIdsToInvalidate.join(", ")} invalidated.`);


  const newEventTx = await ticketingPlatform.connect(organizer).createEvent(
    "Conference",
    "Convention Center",
    Math.floor(Date.now() / 1000) + 7200, // 2 hours in the future
    2, // Ticket price in USD
    50 // Number of tickets
  );
  await newEventTx.wait();

  const newEventReceipt = await newEventTx.wait();
  const newEventCreatedEvent = newEventReceipt.events.find(event => event.event === "EventCreated");
  const newEventAddress = newEventCreatedEvent.args.eventAddress;

  const newEventContract = EventContract.attach(newEventAddress);

  // Buyer2 purchases tickets for the new event
  const newTicketPriceInWei = await newEventContract.getTicketPriceInWei();
  const newQuantity = 2;
  const newTotalPriceWithoutFee = newTicketPriceInWei.mul(newQuantity);
  const newServiceFee = newTotalPriceWithoutFee.mul(2).div(100);
  const newTotalPriceWithFee = newTotalPriceWithoutFee.add(newServiceFee);

  const newBuyTicketsTx = await newEventContract.connect(buyer2).buyTickets(newQuantity, { value: newTotalPriceWithFee });
  await newBuyTicketsTx.wait();

  // Organizer withdraws funds from the new event
  const withdrawFundsTx = await newEventContract.connect(organizer).withdrawFunds();
  console.log("Organizer withdrawing funds from new event, tx hash:", withdrawFundsTx.hash);

  await withdrawFundsTx.wait();
  console.log("Organizer successfully withdrew funds from the new event.");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Error interacting with contracts:", error);
    process.exit(1);
  });
