
FROM python:3.13-slim


WORKDIR /code


COPY ./requirements.txt /code/requirements.txt


RUN pip install --no-cache-dir --upgrade -r /code/requirements.txt


COPY ./backend/app /code/app
COPY ./backend /code/backend  

CMD ["fastapi", "run", "app/main.py", "--proxy-headers", "--port", "8000"]