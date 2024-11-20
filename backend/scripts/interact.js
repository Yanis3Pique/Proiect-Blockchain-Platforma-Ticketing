const { ethers } = require("hardhat");

async function main() {
    const contractAddress = "0x86Dd4A46B95460d1AFD63DA97886952dcf1F8c22"; // Adresa TicketingPlatform
    const TicketingPlatform = await ethers.getContractFactory("TicketingPlatform");
    const ticketingPlatform = TicketingPlatform.attach(contractAddress);

    console.log("Interacționând cu TicketingPlatform la adresa:", ticketingPlatform.target);

    // Afișează următorul ID de eveniment
    const nextEventId = await ticketingPlatform.nextEventId();
    console.log("Next Event ID:", nextEventId.toString());

    // Creează un eveniment
    const tx = await ticketingPlatform.createEvent(
        "Concert",
        "Stadium Bucuresti",
        Math.floor(Date.now() / 1000) + 3600, // O oră în viitor
        1, // Prețul biletului în USD
        100 // Numărul de bilete
    );
    console.log("Creating event, transaction hash:", tx.hash);

    // Așteaptă confirmarea tranzacției
    const receipt = await tx.wait();
    console.log("Event created in block:", receipt.blockNumber);

    // Obține adresa evenimentului creat
    const eventId = nextEventId; // Folosim BigInt direct
    const eventAddress = await ticketingPlatform.getEventAddress(eventId);
    console.log("Event address:", eventAddress);

    // Creează o instanță a EventContract
    const EventContract = await ethers.getContractFactory("EventContract");
    const eventContract = EventContract.attach(eventAddress);
    console.log("Interacționând cu EventContract la adresa:", eventContract.target);

    const latestPrice = await eventContract.getLatestPrice();
    console.log("Latest ETH/USD price:", latestPrice.toString());


    // Obține prețul biletului în Wei
    const ticketPriceInWei = await eventContract.getTicketPriceInWei();
    console.log("Ticket price in Wei:", ethers.formatEther(ticketPriceInWei), "WEI");

    // Cumpără un bilet
    const buyTx = await eventContract.buyTicket({ value: ticketPriceInWei });
    console.log("Buying ticket, transaction hash:", buyTx.hash);

    // Așteaptă confirmarea tranzacției
    const buyReceipt = await buyTx.wait();
    console.log("Ticket purchased in block:", buyReceipt.blockNumber);
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("Error interacting with contract:", error);
        process.exit(1);
    });
