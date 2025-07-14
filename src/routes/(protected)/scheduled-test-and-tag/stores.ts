import { writable } from 'svelte/store';
import type { Writable } from 'svelte/store';

export type Contact = {
    name: string;
    phone: string;
    email: string;
};

export type LocationInfo = {
    sub_company_name: string;
    location: string;
    contacts: Contact[];
};

export type Note = {
    title: string;
    content: string;
};

export type Schedule = {
    id: number;
    company: string;
    start_month: number;
    occurence: number;
    information: LocationInfo[];
    notes: Note[];
};

// Initial data
const initialSchedules: Schedule[] = [
    {
        "id": 1,
        "company": "Wollongong Hospital",
        "start_month": 7,
        "occurence": 6,
        "information": [
            {
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
        "id": 2,
        "company": "Shellharbour Private Hospital",
        "start_month": 8,
        "occurence": 4,
        "information": [
            {
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
        "id": 3,
        "company": "Port Kembla Hospital",
        "start_month": 6,
        "occurence": 3,
        "information": [
            {
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
    },{
        "id": 4,
        "company": "Dapto Community Health",
        "start_month": 9,
        "occurence": 2,
        "information": [
          {
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
        "id": 5,
        "company": "Corrimal Rehab Centre",
        "start_month": 5,
        "occurence": 5,
        "information": [
          {
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
        "id": 6,
        "company": "Kiama Aged Care",
        "start_month": 10,
        "occurence": 1,
        "information": [
          {
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
        "id": 7,
        "company": "Shoalhaven District Hospital",
        "start_month": 3,
        "occurence": 2,
        "information": [
          {
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
        "id": 8,
        "company": "Fairy Meadow Medical Centre",
        "start_month": 11,
        "occurence": 4,
        "information": [
          {
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