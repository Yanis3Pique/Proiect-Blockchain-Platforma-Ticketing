import React, { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import { useWeb3React } from '@web3-react/core';
import EventContractJSON from '../abis/EventContract.json';
import TicketingPlatform from '../abis/TicketingPlatform.json';

const MyTickets = () => {
    const { account, library } = useWeb3React();
    const [tickets, setTickets] = useState([]);
    const [loading, setLoading] = useState(true);
    const [transferringTickets, setTransferringTickets] = useState({});

    // Function to fetch tickets owned by the user
    const fetchTickets = async () => {
        if (!account || !library) return;

        try {
            const provider = library || new ethers.providers.Web3Provider(window.ethereum);
            const signer = provider.getSigner();

            // Fetch all event addresses from the TicketingPlatform contract
            const ticketingPlatformAddress = "0xd0Ad10a89F50164446d95146b5CCa35aFB72fd15";
            const platformContract = new ethers.Contract(ticketingPlatformAddress, TicketingPlatform.abi, provider);

            const nextEventIdBN = await platformContract.nextEventId();
            const nextEventId = nextEventIdBN.toNumber();

            const eventAddresses = [];
            for (let eventId = 0; eventId < nextEventId; eventId++) {
                const eventAddress = await platformContract.getEventAddress(eventId);
                eventAddresses.push(eventAddress);
            }

            const fetchedTickets = [];

            for (const eventAddress of eventAddresses) {
                const eventContract = new ethers.Contract(eventAddress, EventContractJSON.abi, provider);

                // Get event details once per event
                const [
                    ,
                    eventName,
                    eventLocation,
                    eventDateBN,
                    ticketPriceUSDBN,
                    ,
                ] = await eventContract.getEventDetails();

                const eventDateTimestamp = eventDateBN.toNumber() * 1000; // Convert to milliseconds

                // Get the total number of tickets minted
                const nextTicketIdBN = await eventContract.nextTicketId();
                const nextTicketId = nextTicketIdBN.toNumber();

                // Loop through tickets to find those owned by the user
                for (let ticketId = 1; ticketId < nextTicketId; ticketId++) {
                    try {
                        const owner = await eventContract.ownerOf(ticketId);
                        if (owner.toLowerCase() === account.toLowerCase()) {

                            const ticket = {
                                ticketId: ticketId,
                                eventAddress: eventAddress,
                                eventName,
                                eventLocation,
                                eventDate: new Date(eventDateTimestamp), // Store as Date object
                                eventDateTimestamp: eventDateTimestamp,
                                eventDateString: new Date(eventDateTimestamp).toLocaleString(), // For display
                                ticketPriceUSD: ticketPriceUSDBN.toNumber(),
                            };

                            fetchedTickets.push(ticket);
                        }
                    } catch (err) {
                        // If ownerOf throws, the token doesn't exist or is burned, skip
                    }
                }
            }

            setTickets(fetchedTickets);
            setLoading(false);
        } catch (error) {
            console.error('Error fetching tickets:', error);
            setLoading(false);
        }
    };

    // Fetch tickets on component mount
    useEffect(() => {
        fetchTickets();
    }, [account, library]);

    // Function to handle ticket transfer
    const handleTransferTicket = async (ticket) => {
        const recipientAddress = prompt('Enter the recipient\'s address:');
        if (!recipientAddress) return; // User cancelled the prompt

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

            const tx = await eventContract.transferTicket(ticket.ticketId, recipientAddress);
            await tx.wait();

            alert('Ticket transferred successfully!');
            // Refresh the tickets list
            await fetchTickets();
        } catch (error) {
            console.error('Error transferring ticket:', error);
            alert(`Error transferring ticket: ${error.message || error}`);
        } finally {
            // Set transferring state to false for this ticket
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
                        {!isEventDatePassed && (
                            <button
                                className="mt-2 bg-blue-500 text-white p-2 rounded disabled:opacity-50"
                                onClick={() => handleTransferTicket(ticket)}
                                disabled={transferringTickets[ticket.ticketId]}
                            >
                                {transferringTickets[ticket.ticketId] ? 'Transferring...' : 'Transfer Ticket'}
                            </button>
                        )}
                    </div>
                );
            })}
        </div>
    );
};

export default MyTickets;
