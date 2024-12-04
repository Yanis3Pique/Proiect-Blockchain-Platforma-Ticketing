import React, { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import { useWeb3React } from '@web3-react/core';
import TicketingPlatform from "../abis/TicketingPlatform.json";
import EventContractJSON from "../abis/EventContract.json";

const EventList = () => {
    const { account, active: isConnected, library } = useWeb3React(); // Hook pentru conectarea la Web3
    const [balance, setBalance] = useState(null);
    const [events, setEvents] = useState([]);
    const [loading, setLoading] = useState(true);
    const [buyingTicket, setBuyingTicket] = useState(false);
    const TicketingPlatformABI = TicketingPlatform.abi;
    const EventContractABI = EventContractJSON.abi;

    // Fetch balanta utilizatorului conectat
    useEffect(() => {
        const fetchBalance = async () => {
            if (library && account) {
                try {
                    const fetchedBalance = await library.getBalance(account);
                    setBalance(ethers.utils.formatEther(fetchedBalance)); // Formateaza balanta in ETH
                } catch (error) {
                    console.error('Error fetching balance:', error);
                }
            }
        };

        if (isConnected) {
            fetchBalance();
        }
    }, [isConnected, library, account]);


    // Fetch lista de evenimente din contractul platformei
    const fetchEvents = async () => {
        try {
            const provider = library || new ethers.providers.Web3Provider(window.ethereum);
            const ticketingPlatformAddress = import.meta.env.VITE_TICKETING_PLATFORM_ADDRESS;

            const platformContract = new ethers.Contract(
                ticketingPlatformAddress,
                TicketingPlatformABI,
                provider
            );

            // Obtine numarul total de evenimente
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
                    eventDate: eventDateBN.toNumber() * 1000,  // Converteste timestamp-ul in milisecunde
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

    // Setup event listeners pentru reactii la evenimentele din contract
    useEffect(() => {
        fetchEvents(); // Fetch initial lista de evenimente

        const setupEventListeners = async () => {
            if (!library) return;
            const provider = library || new ethers.providers.Web3Provider(window.ethereum);
            const ticketingPlatformAddress = import.meta.env.VITE_TICKETING_PLATFORM_ADDRESS;
            const platformContract = new ethers.Contract(
                ticketingPlatformAddress,
                TicketingPlatformABI,
                provider
            );

            const nextEventId = await platformContract.nextEventId();

            for (let eventId = 0; eventId < nextEventId; eventId++) {
                const eventAddress = await platformContract.getEventAddress(eventId);
                const eventContract = new ethers.Contract(eventAddress, EventContractABI, provider);


                const handleTicketPurchased = async (ticketId, buyer) => {
                    console.log(`Ticket ${ticketId} purchased by ${buyer}`);

                    await fetchEvents();
                };


                const handleEventCancelled = async () => {
                    console.log(`Event at ${eventAddress} has been cancelled.`);

                    await fetchEvents();
                };

                eventContract.on("TicketPurchased", handleTicketPurchased);
                eventContract.on("EventCancelled", handleEventCancelled);

                // Oprim listener-ele la final
                return () => {
                    eventContract.off("TicketPurchased", handleTicketPurchased);
                    eventContract.off("EventCancelled", handleEventCancelled);
                };
            }
        };

        setupEventListeners();


        return () => {
            // Cleanup general
        };
    }, [library]);

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
            const quantityStr = prompt('Enter the number of tickets you want to buy:', '1');

            if (!quantityStr) {
                setBuyingTicket(false);
                return;
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

            const eventContract = new ethers.Contract(event.eventAddress, EventContractABI, signer);
            const totalPriceWithFee = await eventContract.getTotalPriceWithFee(quantity);
            const gasEstimate = await eventContract.estimateGas.buyTickets(quantity, { value: totalPriceWithFee });

            alert('Transaction is being processed. Please wait...');


            const tx = await eventContract.buyTickets(quantity, {
                value: totalPriceWithFee,
                gasLimit: gasEstimate.mul(110).div(100),  // Adauga 10% buffer pentru estimarea gazului
            });

            // Asteptam sa fie minata tranzactia
            await tx.wait();
            alert('Tickets purchased successfully!');
            await fetchEvents();
        } catch (error) {
            console.error('Error buying tickets:', error);

            if (error.code === 'INSUFFICIENT_FUNDS') {
                alert('You have insufficient funds to complete this purchase.');
            } else if (error.code === 'USER_REJECTED_TRANSACTION') {
                alert('Transaction rejected by the user.');
            } else if (error.data && error.data.message) {
                const reason = error.data.message;
                alert(`Transaction failed: ${reason}`);
            } else {
                alert(`Error buying tickets: ${error.message || error}`);
            }
        } finally {
            setBuyingTicket(false);
        }
    };

    if (loading) {
        return <div>Loading events...</div>;
    }

    const activeEvents = events.filter(event => !event.isCancelled); // Filtreaza doar evenimentele active

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
                    const eventDate = new Date(event.eventDate);
                    const isEventInPast = eventDate < new Date();

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
