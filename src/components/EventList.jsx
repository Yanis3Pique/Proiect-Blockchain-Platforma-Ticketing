import React, { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import { useWeb3React } from '@web3-react/core';
import TicketingPlatform from "../abis/TicketingPlatform.json";
import EventContractJSON from "../abis/EventContract.json";

const EventList = () => {
    const { account, active: isConnected, library } = useWeb3React();
    const [balance, setBalance] = useState(null);
    const [events, setEvents] = useState([]);
    const [loading, setLoading] = useState(true);
    const [buyingTicket, setBuyingTicket] = useState(false);
    const TicketingPlatformABI = TicketingPlatform.abi;
    const EventContractABI = EventContractJSON.abi;

    // Fetch balance when connected
    useEffect(() => {
        const fetchBalance = async () => {
            if (library && account) {
                try {
                    const fetchedBalance = await library.getBalance(account);
                    setBalance(ethers.utils.formatEther(fetchedBalance));
                } catch (error) {
                    console.error('Error fetching balance:', error);
                }
            }
        };

        if (isConnected) {
            fetchBalance();
        }
    }, [isConnected, library, account]);

    const fetchEvents = async () => {
        try {
            const provider = library || new ethers.providers.Web3Provider(window.ethereum);
            const ticketingPlatformAddress = "0xd0Ad10a89F50164446d95146b5CCa35aFB72fd15";

            const platformContract = new ethers.Contract(
                ticketingPlatformAddress,
                TicketingPlatformABI,
                provider
            );

            // Get the total number of events
            const nextEventId = await platformContract.nextEventId();

            const fetchedEvents = [];
            for (let eventId = 0; eventId < nextEventId; eventId++) {
                const eventAddress = await platformContract.getEventAddress(eventId);
                const eventContract = new ethers.Contract(eventAddress, EventContractABI, provider);

                const [
                    eventIdBN,
                    eventName,
                    eventLocation,
                    eventDateBN,
                    ticketPriceUSDBN,
                    ticketsAvailableBN,
                    organizer,
                    isCancelled
                ] = await eventContract.getEventDetails();

                fetchedEvents.push({
                    eventId: eventIdBN.toNumber(),
                    eventName,
                    eventLocation,
                    eventDate: eventDateBN.toNumber(),
                    ticketPriceUSD: ticketPriceUSDBN.toNumber(),
                    ticketsAvailable: ticketsAvailableBN.toNumber(),
                    organizer,
                    eventAddress,
                    isCancelled
                });
            }

            setEvents(fetchedEvents);
            setLoading(false);
        } catch (error) {
            console.error('Error fetching events:', error);
            setLoading(false);
        }
    };

    // Fetch events
    useEffect(() => {
        fetchEvents();
    }, [library]);

    // Function to handle ticket purchase
    const handleBuyTickets = async (event) => {
        if (event.isCancelled) {
            alert('This event has been cancelled.');
            return;
        }
        setBuyingTicket(true);
        if (!isConnected) {
            alert('Please connect your wallet to buy tickets.');
            setBuyingTicket(false);
            return;
        }

        try {
            const provider = library || new ethers.providers.Web3Provider(window.ethereum);
            const signer = provider.getSigner();

            // Prompt user for number of tickets
            const quantityStr = prompt('Enter the number of tickets you want to buy:', '1');
            if (!quantityStr) {
                setBuyingTicket(false);
                return; // User cancelled the prompt
            }
            const quantity = parseInt(quantityStr);
            if (isNaN(quantity) || quantity <= 0) {
                alert('Invalid ticket quantity.');
                setBuyingTicket(false);
                return;
            }

            if (quantity > event.ticketsAvailable) {
                alert('Not enough tickets available.');
                setBuyingTicket(false);
                return;
            }

            // Connect to the event contract
            const eventContract = new ethers.Contract(event.eventAddress, EventContractABI, signer);

            // Get the total price with the service fee from the contract
            const totalPriceWithFee = await eventContract.getTotalPriceWithFee(quantity);

            // Call the buyTickets function, sending the required value
            const tx = await eventContract.buyTickets(quantity, { value: totalPriceWithFee });

            // Wait for the transaction to be mined
            await tx.wait();
            alert('Tickets purchased successfully!');
            await fetchEvents();
            setBuyingTicket(false);
        } catch (error) {
            console.error('Error buying tickets:', error);
            alert(`Error buying tickets: ${error.message || error}`);
            setBuyingTicket(false);
        }
    };

    if (loading) {
        return <div>Loading events...</div>;
    }

    const activeEvents = events.filter(event => !event.isCancelled);

    return (
        <div>
            <h2 className="text-2xl mb-4">Available Events</h2>
            {isConnected ? (
                <div className="mb-4 border p-4 rounded bg-gray-100">
                    <p><strong>Connected Account:</strong> {account}</p>
                    <p><strong>Balance:</strong> {balance ? `${balance} ETH` : 'Loading...'}</p>
                </div>
            ) : (
                <div className="mb-4 border p-4 rounded bg-yellow-100">
                    <p>Please connect your wallet to see your account and balance.</p>
                </div>
            )}
            {activeEvents.length === 0 ? (
                <p>No events found</p>
            ) : (
                activeEvents.map((event, index) => {
                    const eventDate = new Date(event.eventDate * 1000); // Convert Unix timestamp to Date object
                    const isEventInPast = eventDate < new Date(); // Check if event date is in the past

                    return (
                        <div key={index} className="border p-4 mb-4 rounded">
                            <h3 className="text-xl font-bold">{event.eventName}</h3>
                            <p>Location: {event.eventLocation}</p>
                            <p>Date: {eventDate.toLocaleString()}</p>
                            <p>Ticket Price: ${event.ticketPriceUSD}</p>
                            <p>Tickets Available: {event.ticketsAvailable}</p>
                            {!isEventInPast ? (
                                <button
                                    className="mt-2 bg-blue-500 text-white p-2 rounded"
                                    onClick={() => handleBuyTickets(event)}
                                    disabled={buyingTicket}
                                >
                                    {buyingTicket ? 'Processing...' : 'Buy Tickets'}
                                </button>
                            ) : (
                                <p className="text-gray-500">This event has already occurred.</p>
                            )}
                        </div>
                    );
                })
            )}
        </div>
    );
};

export default EventList;
