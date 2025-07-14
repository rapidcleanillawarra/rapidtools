import { writable } from 'svelte/store';
import type { Writable } from 'svelte/store';

export type Contact = {
    name: string;
    phone: string;
    email: string;
};

export type LocationInfo = {
    information_id: string;
    sub_company_name: string;
    location: string;
    contacts: Contact[];
};

export type Note = {
    title: string;
    content: string;
};

export type Schedule = {
    id: string;
    company: string;
    start_month: number;
    occurence: number;
    information: LocationInfo[];
    notes: Note[];
    createdAt?: any; // Firestore timestamp
    updatedAt?: any; // Firestore timestamp
};

// Initial data
const initialSchedules: Schedule[] = [
    {
      "id": "1",
      "company": "Wollongong Hospital",
      "start_month": 7,
      "occurence": 6,
      "information": [
        {
          "information_id": "a22437e3-a347-4a62-892a-98f2076996a1",
          "sub_company_name": "Woll Hosp Tug STT",
          "location": "3B Medical Services Wing, Loftus Street, Wollongong",
          "contacts": [
            {
              "name": "Rachel Clarke",
              "phone": "0412 345 678",
              "email": "rachel.clarke@health.nsw.gov.au"
            }
          ]
        },
        {
          "information_id": "e50e1a88-2ea9-429c-a765-65fe2c5e623d",
          "sub_company_name": "Woll Hosp Scrubbers STT",
          "location": "Ground Floor Engineering Bay, Loftus Street, Wollongong",
          "contacts": [
            {
              "name": "Dean Morgan",
              "phone": "0401 234 567",
              "email": "dean.morgan@health.nsw.gov.au"
            }
          ]
        },
        {
          "information_id": "385ca82b-3fe6-400f-a651-287a6cd5897f",
          "sub_company_name": "Woll Hosp Vac & Polisher STT",
          "location": "Maintenance Shed A, Back Entrance via Crown Lane, Wollongong",
          "contacts": [
            {
              "name": "Linda Tran",
              "phone": "0423 456 789",
              "email": "linda.tran@health.nsw.gov.au"
            }
          ]
        }
      ],
      "notes": [
        {
          "title": "Machine Access",
          "content": "Ensure access to storeroom is arranged through Engineering by 7:30 AM. Bring keycard."
        },
        {
          "title": "Consumables Supplied",
          "content": "Supplied: replacement filters, scrubber blades, vacuum belts. Request confirmation of quantities before next visit."
        }
      ]
    },
    {
      "id": "2",
      "company": "Shellharbour Private Hospital",
      "start_month": 8,
      "occurence": 4,
      "information": [
        {
          "information_id": "ed782eeb-c65f-4482-a987-a757075a4301",
          "sub_company_name": "Shell Hosp OR STT",
          "location": "Operating Theatres Basement, Madigan Boulevard, Shellharbour",
          "contacts": [
            {
              "name": "John Barrett",
              "phone": "0456 789 123",
              "email": "john.barrett@shellprivate.com.au"
            }
          ]
        },
        {
          "information_id": "40b22fd5-a284-4472-92e6-381306947ac4",
          "sub_company_name": "Shell Hosp Admin Scrubbers",
          "location": "Admin Block Loading Dock, Madigan Boulevard, Shellharbour",
          "contacts": [
            {
              "name": "Sarah Nguyen",
              "phone": "0467 123 456",
              "email": "sarah.nguyen@shellprivate.com.au"
            }
          ]
        },
        {
          "information_id": "2feafb81-cac6-4848-a7a8-10b25cd2d431",
          "sub_company_name": "Shell Hosp Polisher STT",
          "location": "North Wing Service Entry, Cnr Lake Entrance Rd & Madigan Blvd, Shellharbour",
          "contacts": [
            {
              "name": "Mick Dawson",
              "phone": "0433 987 654",
              "email": "mick.dawson@shellprivate.com.au"
            }
          ]
        }
      ],
      "notes": [
        {
          "title": "Parking Instructions",
          "content": "Use technician parking behind Pathology. Permit must be displayed at all times."
        },
        {
          "title": "Safety Briefing",
          "content": "All visitors must complete a 5-minute site induction at reception before accessing any machinery areas."
        }
      ]
    },
    {
      "id": "3",
      "company": "Port Kembla Hospital",
      "start_month": 6,
      "occurence": 3,
      "information": [
        {
          "information_id": "8990d242-b931-455f-bed8-e54ac2fa18a7",
          "sub_company_name": "PK Hosp Workshop STT",
          "location": "Workshop Zone C, Cowper Street, Port Kembla",
          "contacts": [
            {
              "name": "Emily Rowe",
              "phone": "0402 111 222",
              "email": "emily.rowe@health.nsw.gov.au"
            },
            {
              "name": "Grant Bell",
              "phone": "0411 333 444",
              "email": "grant.bell@health.nsw.gov.au"
            },
            {
              "name": "Helen Kaur",
              "phone": "0430 555 666",
              "email": "helen.kaur@health.nsw.gov.au"
            }
          ]
        }
      ],
      "notes": []
    },
    {
      "id": "4",
      "company": "Dapto Community Health",
      "start_month": 9,
      "occurence": 2,
      "information": [
        {
          "information_id": "58773245-4f25-485f-b795-2822c879dacb",
          "sub_company_name": "Dapto Health Equip STT",
          "location": "2nd Floor, Medical Equipment Room, Princes Hwy, Dapto",
          "contacts": [
            {
              "name": "Anna Mitchell",
              "email": "anna.mitchell@health.nsw.gov.au",
              "phone": ""
            }
          ]
        }
      ],
      "notes": []
    },
    {
      "id": "5",
      "company": "Corrimal Rehab Centre",
      "start_month": 5,
      "occurence": 5,
      "information": [
        {
          "information_id": "96c71475-5328-4ebe-adeb-f75ccd7f6654",
          "sub_company_name": "Corrimal Rehab STT",
          "location": "Main Entrance Workshop, Railway Street, Corrimal",
          "contacts": [
            {
              "name": "Mark Tan",
              "phone": "0405 789 000",
              "email": ""
            },
            {
              "name": "Tina Brooks",
              "email": "tina.brooks@rehab.org.au",
              "phone": ""
            }
          ]
        }
      ],
      "notes": [
        {
          "title": "Access Instructions",
          "content": "Contact security to unlock rear gate before 8 AM."
        }
      ]
    },
    {
      "id": "6",
      "company": "Kiama Aged Care",
      "start_month": 10,
      "occurence": 1,
      "information": [
        {
          "information_id": "ac37c3d0-7830-49dd-95ac-70b530c3a11a",
          "sub_company_name": "Kiama Aged Scrubber",
          "location": "Equipment Bay, Hindmarsh Park Access Road, Kiama",
          "contacts": [
            {
              "name": "Leo Carter",
              "phone": "0477 112 233",
              "email": ""
            }
          ]
        }
      ],
      "notes": []
    },
    {
      "id": "7",
      "company": "Shoalhaven District Hospital",
      "start_month": 3,
      "occurence": 2,
      "information": [
        {
          "information_id": "65be85d5-8bd8-4d76-8e16-6a2d0c7f9f70",
          "sub_company_name": "Shoal Hosp STT",
          "location": "Ground Level Maintenance Hub, Shoalhaven Street, Nowra",
          "contacts": [
            {
              "name": "Sophie Ellis",
              "email": "sophie.ellis@health.nsw.gov.au",
              "phone": ""
            }
          ]
        },
        {
          "information_id": "269c061f-f795-4be7-af16-b9557aa37846",
          "sub_company_name": "Shoal Scrubber Unit",
          "location": "Rear Loading Dock, Shoalhaven Street, Nowra",
          "contacts": [
            {
              "name": "Dave Ritchie",
              "phone": "0488 999 123",
              "email": ""
            }
          ]
        }
      ],
      "notes": []
    },
    {
      "id": "8",
      "company": "Fairy Meadow Medical Centre",
      "start_month": 11,
      "occurence": 4,
      "information": [
        {
          "information_id": "6d4664b3-e43c-45dc-b58d-c06b7ea4233c",
          "sub_company_name": "FMMC Scrubber Bay",
          "location": "Service Shed 1, Guest Avenue, Fairy Meadow",
          "contacts": [
            {
              "name": "Karen O'Neil",
              "email": "karen.oneil@fmmc.org.au",
              "phone": ""
            },
            {
              "name": "Liam Grant",
              "phone": "0491 222 333",
              "email": ""
            }
          ]
        },
        {
          "information_id": "9a4461b4-55d0-42ff-9a25-180d7cf324e5",
          "sub_company_name": "FMMC Vacuum Station",
          "location": "Basement Equipment Access, Guest Avenue, Fairy Meadow",
          "contacts": [
            {
              "name": "Michelle Wong",
              "phone": "0400 111 999",
              "email": "michelle.wong@fmmc.org.au"
            },
            {
              "name": "Aaron Smith",
              "email": "aaron.smith@fmmc.org.au",
              "phone": ""
            }
          ]
        }
      ],
      "notes": [
        {
          "title": "Entry Requirements",
          "content": "Staff must wear ID badges and sign in with security before entering restricted areas."
        },
        {
          "title": "Equipment Prep",
          "content": "Machines must be tagged with issue notes before servicing."
        }
      ]
    }
  ];

export const schedulesStore: Writable<Schedule[]> = writable(initialSchedules); 