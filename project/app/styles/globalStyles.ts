// styles/globalStyles.ts
import { StyleSheet } from 'react-native';

export default StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff', // switch to '#000000' for dark mode if needed
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  button: {
    backgroundColor: '#2ecc71', // green
    padding: 12,
    borderRadius: 8,
    marginVertical: 8,
    width: '100%',
    maxWidth: 300,
  },
  buttonText: {
    color: '#ffffff', // white text
    fontWeight: 'bold',
    textAlign: 'center',
    fontSize: 16,
  },
  inputField: {
    borderColor: '#cccccc',
    borderWidth: 1,
    borderRadius: 8,
    marginVertical: 8,
    padding: 12,
    width: '100%',
    maxWidth: 300,
    fontSize: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 20,
    color: '#2ecc71',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 18,
    color: '#555',
    marginBottom: 20,
    textAlign: 'center',
  },
  errorText: {
    color: 'red',
    marginVertical: 8,
    textAlign: 'center',
  },
  link: {
    color: '#2ecc71',
    marginTop: 15,
    textAlign: 'center',
  }
});