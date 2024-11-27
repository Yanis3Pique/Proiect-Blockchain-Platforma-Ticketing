import React, { useState } from 'react';
import { ethers } from 'ethers';
import { useWeb3React } from '@web3-react/core';

const EventCreation = () => {
    const { active, account, library } = useWeb3React();
    const [eventDetails, setEventDetails] = useState({
        eventName: '',
        eventLocation: '',
        eventDate: '',
        ticketPrice: '',
        ticketsAvailable: '',
    });

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
            const signer = library.getSigner();
            const platformContractAddress = 'YOUR_PLATFORM_CONTRACT_ADDRESS';
            const platformContractABI = []; // Replace with your contract ABI

            const platformContract = new ethers.Contract(
                platformContractAddress,
                platformContractABI,
                signer
            );

            const timestamp = Math.floor(new Date(eventDetails.eventDate).getTime() / 1000);
            const tx = await platformContract.createEvent(
                eventDetails.eventName,
                eventDetails.eventLocation,
                timestamp,
                parseInt(eventDetails.ticketPrice),
                parseInt(eventDetails.ticketsAvailable)
            );

            const receipt = await tx.wait();
            console.log('Event created:', receipt);
            alert('Event created successfully!');
        } catch (error) {
            console.error('Error creating event:', error);
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
                    />
                    <button onClick={createEvent} className="w-full bg-green-500 text-white p-2 rounded">
                        Create Event
                    </button>
                </div>
            ) : (
                <p>Please connect your wallet to create an event</p>
            )}
        </div>
    );
};

export default EventCreation;
