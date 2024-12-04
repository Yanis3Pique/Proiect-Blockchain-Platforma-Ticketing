import React, { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import { useWeb3React } from '@web3-react/core';
import EventContractJSON from '../abis/EventContract.json';
import TicketingPlatform from '../abis/TicketingPlatform.json';

const MyTickets = () => {
    const { account, library } = useWeb3React(); // Hook pentru gestionarea conexiunii Web3
    const [tickets, setTickets] = useState([]);
    const [loading, setLoading] = useState(true);
    const [transferringTickets, setTransferringTickets] = useState({});

    const fetchTickets = async () => {
        if (!account || !library) return; // Daca nu exista cont sau biblioteca Web3, iesim

        try {
            const provider = library || new ethers.providers.Web3Provider(window.ethereum);
            const ticketingPlatformAddress = "0x6E6166713b570d92A18CF0993e33c8AC882c3be6";
            const platformContract = new ethers.Contract(ticketingPlatformAddress, TicketingPlatform.abi, provider);

            const nextEventIdBN = await platformContract.nextEventId(); // Numarul total de evenimente
            const nextEventId = nextEventIdBN.toNumber();

            const eventAddresses = [];
            for (let eventId = 0; eventId < nextEventId; eventId++) {
                const eventAddress = await platformContract.getEventAddress(eventId);
                console.log(`Event ID ${eventId} Address: ${eventAddress}`);
                eventAddresses.push(eventAddress);
            }

            const fetchedTickets = [];

            for (const eventAddress of eventAddresses) {
                console.log(`Processing event at address: ${eventAddress}`);
                const eventContract = new ethers.Contract(eventAddress, EventContractJSON.abi, provider);

                let eventDetails;
                try {
                    eventDetails = await eventContract.getEventDetails();
                } catch (error) {
                    console.error(`Error fetching event details for event at ${eventAddress}:`, error);
                    continue;
                }

                const [
                    ,
                    eventName,
                    eventLocation,
                    eventDateBN,
                    ticketPriceUSDBN,
                    ,
                ] = eventDetails;

                const eventDateTimestamp = eventDateBN.toNumber() * 1000; // Conversie la milisecunde


                let ticketIdsBN;
                try {
                    ticketIdsBN = await eventContract.getTicketsOfOwner(account);
                } catch (error) {
                    console.error(`Error fetching tickets for owner at event ${eventAddress}:`, error);
                    continue;
                }

                const ticketIds = ticketIdsBN.map(id => id.toNumber());

                for (const ticketId of ticketIds) {
                    const ticket = {
                        ticketId: ticketId,
                        eventAddress: eventAddress,
                        eventName,
                        eventLocation,
                        eventDate: new Date(eventDateTimestamp),
                        eventDateTimestamp: eventDateTimestamp,
                        eventDateString: new Date(eventDateTimestamp).toLocaleString(),
                        ticketPriceUSD: ticketPriceUSDBN.toNumber(),
                    };

                    fetchedTickets.push(ticket);
                }
            }

            setTickets(fetchedTickets);
            setLoading(false);
        } catch (error) {
            console.error('Error fetching tickets:', error);
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchTickets();
    }, [account, library]);

    const handleTransferTicket = async (ticket) => {
        const recipientAddress = prompt('Enter the recipient\'s address:');
        if (!recipientAddress) return;

        if (!ethers.utils.isAddress(recipientAddress)) {
            alert('Invalid address.');
            return;
        }

        try {
            setTransferringTickets((prevState) => ({
                ...prevState,
                [ticket.ticketId]: true,
            }));
            const provider = library || new ethers.providers.Web3Provider(window.ethereum);
            const signer = provider.getSigner();
            const eventContract = new ethers.Contract(ticket.eventAddress, EventContractJSON.abi, signer);

            // Estimam gazul necesar
            const gasEstimate = await eventContract.estimateGas.transferTicket(ticket.ticketId, recipientAddress);
            const tx = await eventContract.transferTicket(ticket.ticketId, recipientAddress, {
                gasLimit: gasEstimate.mul(110).div(100),
            });

            await tx.wait();

            alert('Ticket transferred successfully!');

            await fetchTickets();
        } catch (error) {
            console.error('Error transferring ticket:', error);
            if (error.code === 'USER_REJECTED_TRANSACTION') {
                alert('Transaction rejected by the user.');
            } else if (error.data && error.data.message) {
                const reason = error.data.message;
                alert(`Transaction failed: ${reason}`);
            } else {
                alert(`Error transferring ticket: ${error.message || error}`);
            }
        } finally {
            setTransferringTickets((prevState) => ({
                ...prevState,
                [ticket.ticketId]: false,
            }));
        }
    };

    if (loading) {
        return <div>Loading your tickets...</div>;
    }

    if (tickets.length === 0) {
        return <div>You have no tickets.</div>;
    }

    return (
        <div>
            <h2 className="text-2xl mb-4">My Tickets</h2>
            {tickets.map((ticket, index) => {
                const isEventDatePassed = ticket.eventDateTimestamp < Date.now();

                return (
                    <div key={index} className="border p-4 mb-4 rounded">
                        <h3>{ticket.eventName}</h3>
                        <p>Ticket ID: {ticket.ticketId}</p>
                        <p>Event Date: {ticket.eventDateString}</p>
                        <p>Location: {ticket.eventLocation}</p>
                        {!isEventDatePassed ? (
                            <button
                                className="mt-2 bg-blue-500 text-white p-2 rounded disabled:opacity-50"
                                onClick={() => handleTransferTicket(ticket)}
                                disabled={transferringTickets[ticket.ticketId]}
                            >
                                {transferringTickets[ticket.ticketId] ? 'Transferring...' : 'Transfer Ticket'}
                            </button>
                        ) : (
                            <p className="text-gray-500">Event has passed. Cannot transfer ticket.</p>
                        )}
                    </div>
                );
            })}
        </div>
    );
};

export default MyTickets;
