from passlib.context import CryptContext

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
password = "test1234!"
hashed = pwd_context.hash(password)
print(hashed)
