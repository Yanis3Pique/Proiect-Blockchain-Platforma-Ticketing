import React, { useState } from 'react';
import { ethers } from 'ethers';
import { useWeb3React } from '@web3-react/core';
import TicketingPlaformJSON from "../abis/TicketingPlatform.json"

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
            const ticketingPlatformAddress = "0x9F91fe777a5618846dd31Dc636ac411F505EdE42";
            const ticketingPlatformABI = TicketingPlaformJSON.abi;

            const platformContract = new ethers.Contract(
                ticketingPlatformAddress,
                ticketingPlatformABI,
                signer
            );

            // Convert eventDate to a timestamp
            const eventDateTimestamp = Math.floor(new Date(eventDetails.eventDate).getTime() / 1000);

            // Prepare the transaction
            const tx = await platformContract.createEvent(
                eventDetails.eventName,
                eventDetails.eventLocation,
                eventDateTimestamp,
                ethers.utils.parseUnits(eventDetails.ticketPriceUSD, 0), // Assuming ticketPriceUSD is an integer
                ethers.BigNumber.from(eventDetails.ticketsAvailable)
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
            alert(`Error creating event: ${error.message || error}`);
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
