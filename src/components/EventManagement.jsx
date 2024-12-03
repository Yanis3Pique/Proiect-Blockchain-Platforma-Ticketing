import React, { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import { useWeb3React } from '@web3-react/core';
import EventContractJSON from '../abis/EventContract.json';
import TicketingPlatform from "../abis/TicketingPlatform.json";

const EventManagement = () => {
    const { account, library } = useWeb3React();
    const [organizedEvents, setOrganizedEvents] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchOrganizedEvents = async () => {
            if (!account || !library) return;

            try {
                const provider = library || new ethers.providers.Web3Provider(window.ethereum);
                const signer = provider.getSigner();

                const ticketingPlatformAddress = "0x6E6166713b570d92A18CF0993e33c8AC882c3be6";
                const platformContract = new ethers.Contract(ticketingPlatformAddress, TicketingPlatform.abi, provider);

                const nextEventId = await platformContract.nextEventId();

                const events = [];
                for (let eventId = 0; eventId < nextEventId; eventId++) {
                    const eventAddress = await platformContract.getEventAddress(eventId);
                    const eventContract = new ethers.Contract(eventAddress, EventContractJSON.abi, signer);

                    const [
                        eventIdBN,
                        eventName,
                        eventLocation,
                        eventDateBN,
                        ticketPriceUSDBN,
                        ticketsAvailableBN,
                        organizer,
                        isCancelled,
                        fundsWithdrawn
                    ] = await eventContract.getEventDetails();

                    console.log("FundsWithdrawn:", fundsWithdrawn);

                    if (organizer.toLowerCase() === account.toLowerCase()) {
                        events.push({
                            eventId: eventIdBN.toNumber(),
                            eventName,
                            eventLocation,
                            eventDate: eventDateBN.toNumber() * 1000, // Convert to milliseconds
                            ticketPriceUSD: ticketPriceUSDBN.toNumber(),
                            ticketsAvailable: ticketsAvailableBN.toNumber(),
                            organizer,
                            eventAddress,
                            isCancelled,
                            fundsWithdrawn
                        });
                    }
                }

                setOrganizedEvents(events);
                setLoading(false);

                // Set up event listeners
                events.forEach(event => {
                    const eventContract = new ethers.Contract(event.eventAddress, EventContractJSON.abi, provider);

                    // Listener for EventCancelled
                    const handleEventCancelled = async () => {
                        console.log(`Event ${event.eventId} has been cancelled.`);
                        await fetchOrganizedEvents();
                    };

                    // Listener for FundsWithdrawn
                    const handleFundsWithdrawn = async () => {
                        console.log(`Funds for event ${event.eventId} have been withdrawn.`);
                        await fetchOrganizedEvents();
                    };

                    // Listener for TicketInvalidated
                    const handleTicketInvalidated = async (ticketId) => {
                        console.log(`Ticket ${ticketId} invalidated for event ${event.eventId}.`);
                        // Optionally update state if needed
                    };

                    eventContract.on("EventCancelled", handleEventCancelled);
                    eventContract.on("FundsWithdrawn", handleFundsWithdrawn);
                    eventContract.on("TicketInvalidated", handleTicketInvalidated);

                    // Clean up listeners when component unmounts
                    return () => {
                        eventContract.off("EventCancelled", handleEventCancelled);
                        eventContract.off("FundsWithdrawn", handleFundsWithdrawn);
                        eventContract.off("TicketInvalidated", handleTicketInvalidated);
                    };
                });
            } catch (error) {
                console.error('Error fetching organized events:', error);
                setLoading(false);
            }
        };

        fetchOrganizedEvents();
    }, [account, library]);

    if (loading) {
        return <div>Loading your events...</div>;
    }

    if (organizedEvents.length === 0) {
        return <div>You have not organized any events.</div>;
    }

    const handleInvalidateTickets = async (event) => {
        const ticketIdsStr = prompt('Enter ticket IDs to invalidate (comma-separated):');
        if (!ticketIdsStr) {
            return; // User cancelled
        }
        const ticketIds = ticketIdsStr.split(',').map(id => id.trim()).map(Number);
        if (ticketIds.some(isNaN)) {
            alert('Invalid ticket IDs.');
            return;
        }

        try {
            const provider = library || new ethers.providers.Web3Provider(window.ethereum);
            const signer = provider.getSigner();
            const eventContract = new ethers.Contract(event.eventAddress, EventContractJSON.abi, signer);

            // Estimate gas
            const gasEstimate = await eventContract.estimateGas.invalidateTickets(ticketIds);

            const tx = await eventContract.invalidateTickets(ticketIds, {
                gasLimit: gasEstimate.mul(110).div(100), // Add 10% buffer
            });
            await tx.wait();

            alert('Tickets invalidated successfully!');
        } catch (error) {
            console.error('Error invalidating tickets:', error);
            if (error.code === 'USER_REJECTED_TRANSACTION') {
                alert('Transaction rejected by the user.');
            } else if (error.data && error.data.message) {
                const reason = error.data.message;
                alert(`Transaction failed: ${reason}`);
            } else {
                alert(`Error invalidating tickets: ${error.message || error}`);
            }
        }
    };

    const handleCancelEvent = async (event) => {
        const confirmCancel = window.confirm('Are you sure you want to cancel this event? This action cannot be undone.');
        if (!confirmCancel) return;

        try {
            const provider = library || new ethers.providers.Web3Provider(window.ethereum);
            const signer = provider.getSigner();
            const eventContract = new ethers.Contract(event.eventAddress, EventContractJSON.abi, signer);

            // Estimate gas
            const gasEstimate = await eventContract.estimateGas.cancelEvent();

            const tx = await eventContract.cancelEvent({
                gasLimit: gasEstimate.mul(110).div(100), // Add 10% buffer
            });
            await tx.wait();

            alert('Event canceled successfully!');
            // Update the event's isCancelled status locally
            setOrganizedEvents(prevEvents => prevEvents.map(e => e.eventId === event.eventId ? { ...e, isCancelled: true } : e));
        } catch (error) {
            console.error('Error canceling event:', error);
            if (error.code === 'USER_REJECTED_TRANSACTION') {
                alert('Transaction rejected by the user.');
            } else if (error.data && error.data.message) {
                const reason = error.data.message;
                alert(`Transaction failed: ${reason}`);
            } else {
                alert(`Error canceling event: ${error.message || error}`);
            }
        }
    };

    const handleWithdrawFunds = async (event) => {
        try {
            const provider = library || new ethers.providers.Web3Provider(window.ethereum);
            const signer = provider.getSigner();
            const eventContract = new ethers.Contract(event.eventAddress, EventContractJSON.abi, signer);

            // Estimate gas
            const gasEstimate = await eventContract.estimateGas.withdrawFunds();

            const tx = await eventContract.withdrawFunds({
                gasLimit: gasEstimate.mul(110).div(100), // Add 10% buffer
            });
            await tx.wait();

            alert('Funds withdrawn successfully!');
            // Update the event's fundsWithdrawn status locally
            setOrganizedEvents(prevEvents =>
                prevEvents.map(e =>
                    e.eventId === event.eventId ? { ...e, fundsWithdrawn: true } : e
                )
            );
        } catch (error) {
            console.error('Error withdrawing funds:', error);
            if (error.code === 'USER_REJECTED_TRANSACTION') {
                alert('Transaction rejected by the user.');
            } else if (error.data && error.data.message) {
                const reason = error.data.message;
                alert(`Transaction failed: ${reason}`);
            } else {
                alert(`Error withdrawing funds: ${error.message || error}`);
            }
        }
    };

    return (
        <div>
            <h2 className="text-2xl mb-4">My Events</h2>
            {organizedEvents.map((event, index) => {
                // Calculate if the current time is at least 30 minutes after the event date
                const currentTime = Date.now();
                const thirtyMinutesInMs = 30 * 60 * 1000; // 30 minutes in milliseconds
                const eventTimePlus30Min = event.eventDate + thirtyMinutesInMs;

                const isAfter30MinutesFromEvent = currentTime <= eventTimePlus30Min;

                return (
                    <div key={index} className="border p-4 mb-4 rounded">
                        <h3 className="text-xl font-bold">{event.eventName}</h3>
                        {/* Add more event details as needed */}
                        {!event.isCancelled ? (
                            !event.fundsWithdrawn ? (
                                <>
                                    {/* Only show Invalidate Tickets button if currentTime >= eventTime + 30 minutes */}
                                    {isAfter30MinutesFromEvent && (
                                        <button
                                            className="mt-2 bg-red-500 text-white p-2 rounded"
                                            onClick={() => handleInvalidateTickets(event)}
                                        >
                                            Invalidate Tickets
                                        </button>
                                    )}
                                    <button
                                        className="mt-2 bg-yellow-500 text-white p-2 rounded"
                                        onClick={() => handleCancelEvent(event)}
                                    >
                                        Cancel Event
                                    </button>
                                    <button
                                        className="mt-2 bg-green-500 text-white p-2 rounded"
                                        onClick={() => handleWithdrawFunds(event)}
                                    >
                                        Withdraw Funds
                                    </button>
                                </>
                            ) : (
                                <p className="text-gray-500">The money has been withdrawn.</p>
                            )
                        ) : (
                            <p className="text-gray-500">Event is canceled. Funds cannot be withdrawn.</p>
                        )}
                    </div>
                );
            })}
        </div>
    );
};

export default EventManagement;
