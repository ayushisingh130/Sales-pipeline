export const TEAM = [
  'Priya',
  'Rahul',
  'Ananya',
  'Vikram',
  'Sneha',
  'Arjun',
  'Kavya',
  'Rohan',
  'Meera',
  'Aditya',
  'Isha',
  'Karan',
  'Neha',
  'Siddharth',
  'Pooja',
  'Aman',
  'Divya',
  'Nikhil',
  'Riya',
  'Varun',
] as const;

/** There is no login; the app is always used as this person. */
export const CURRENT_USER = 'Priya';

export const TEAMMATES = TEAM.filter((name) => name !== CURRENT_USER);
