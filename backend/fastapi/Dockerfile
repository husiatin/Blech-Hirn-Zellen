
FROM python:3.13-alpine


WORKDIR /code


COPY ./requirements.txt /code/requirements.txt


RUN pip install --no-cache-dir --upgrade -r /code/requirements.txt


COPY ./app /code/app
COPY ./board_presets /code/board_presets

CMD ["fastapi", "run", "app/main.py", "--proxy-headers", "--port", "8000"]