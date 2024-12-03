import React, { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import { useWeb3React } from '@web3-react/core';
import TicketingPlatformJSON from "../abis/TicketingPlatform.json";

const EventCreation = () => {
    const { active, library } = useWeb3React();
    const [eventDetails, setEventDetails] = useState({
        eventName: '',
        eventLocation: '',
        eventDate: '',
        ticketPriceUSD: '',
        ticketsAvailable: '',
    });
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (!active || !library) return;

        const provider = new ethers.providers.Web3Provider(window.ethereum);
        const ticketingPlatformAddress = "0xC4fA925669A73c0c405d9AA6Bddb03e944091090";
        const platformContract = new ethers.Contract(
            ticketingPlatformAddress,
            TicketingPlatformJSON.abi,
            provider
        );

        const handleEventCreated = (eventId, eventAddress, organizer) => {
            console.log("Event Created:", { eventId, eventAddress, organizer });
            alert(`Event Created! Event ID: ${eventId.toString()}`);
            // Optionally refresh events or update UI here
        };

        // Listen to the EventCreated event
        platformContract.on("EventCreated", handleEventCreated);

        // Clean up the listener when the component unmounts
        return () => {
            platformContract.off("EventCreated", handleEventCreated);
        };
    }, [active, library]);

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setEventDetails((prev) => ({
            ...prev,
            [name]: value,
        }));
    };

    const createEvent = async () => {
        if (!active) {
            alert('Please connect your wallet first');
            return;
        }

        try {
            setLoading(true);
            const signer = library.getSigner();
            const ticketingPlatformAddress = "0x6E6166713b570d92A18CF0993e33c8AC882c3be6";
            const ticketingPlatformABI = TicketingPlatformJSON.abi;

            const platformContract = new ethers.Contract(
                ticketingPlatformAddress,
                ticketingPlatformABI,
                signer
            );

            // Convert eventDate to a timestamp
            const eventDateTimestamp = Math.floor(new Date(eventDetails.eventDate).getTime() / 1000);

            // Estimate gas
            const gasEstimate = await platformContract.estimateGas.createEvent(
                eventDetails.eventName,
                eventDetails.eventLocation,
                eventDateTimestamp,
                ethers.utils.parseUnits(eventDetails.ticketPriceUSD, 0),
                ethers.BigNumber.from(eventDetails.ticketsAvailable)
            );

            console.log(`Estimated gas: ${gasEstimate.toString()}`);

            // Prepare the transaction with gas limit
            const tx = await platformContract.createEvent(
                eventDetails.eventName,
                eventDetails.eventLocation,
                eventDateTimestamp,
                ethers.utils.parseUnits(eventDetails.ticketPriceUSD, 0),
                ethers.BigNumber.from(eventDetails.ticketsAvailable),
                {
                    gasLimit: gasEstimate.mul(110).div(100), // Add 10% buffer
                }
            );

            // Wait for the transaction to be mined
            await tx.wait();

            console.log('Event created:', tx);
            alert('Event created successfully!');
            // Reset form
            setEventDetails({
                eventName: '',
                eventLocation: '',
                eventDate: '',
                ticketPriceUSD: '',
                ticketsAvailable: '',
            });
        } catch (error) {
            console.error('Error creating event:', error);

            // Improved error handling
            if (error.code === 'UNPREDICTABLE_GAS_LIMIT') {
                alert('Gas estimation failed. Please try again.');
            } else if (error.code === 'USER_REJECTED_TRANSACTION') {
                alert('Transaction rejected by the user.');
            } else if (error.data && error.data.message) {
                const reason = error.data.message;
                alert(`Transaction failed: ${reason}`);
            } else {
                alert(`Error creating event: ${error.message || error}`);
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="max-w-md mx-auto">
            <h2 className="text-2xl mb-4">Create New Event</h2>
            {active ? (
                <div className="space-y-4">
                    <input
                        type="text"
                        name="eventName"
                        value={eventDetails.eventName}
                        onChange={handleInputChange}
                        placeholder="Event Name"
                        className="w-full p-2 border rounded"
                        required
                    />
                    <input
                        type="text"
                        name="eventLocation"
                        value={eventDetails.eventLocation}
                        onChange={handleInputChange}
                        placeholder="Event Location"
                        className="w-full p-2 border rounded"
                        required
                    />
                    <input
                        type="datetime-local"
                        name="eventDate"
                        value={eventDetails.eventDate}
                        onChange={handleInputChange}
                        placeholder="Event Date"
                        className="w-full p-2 border rounded"
                        required
                    />
                    <input
                        type="number"
                        name="ticketPriceUSD"
                        value={eventDetails.ticketPriceUSD}
                        onChange={handleInputChange}
                        placeholder="Ticket Price (USD)"
                        className="w-full p-2 border rounded"
                        required
                    />
                    <input
                        type="number"
                        name="ticketsAvailable"
                        value={eventDetails.ticketsAvailable}
                        onChange={handleInputChange}
                        placeholder="Tickets Available"
                        className="w-full p-2 border rounded"
                        required
                    />
                    <button
                        onClick={createEvent}
                        className="w-full bg-green-500 text-white p-2 rounded"
                        disabled={loading}
                    >
                        {loading ? 'Creating Event...' : 'Create Event'}
                    </button>
                </div>
            ) : (
                <p>Please connect your wallet to create an event</p>
            )}
        </div>
    );
};

export default EventCreation;
